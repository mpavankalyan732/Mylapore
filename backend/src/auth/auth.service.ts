import {
  BadRequestException, ConflictException, Injectable, Logger, NotImplementedException, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { createHash, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { promisify } from 'util';
import { normalisePhone } from '../orders/pricing';
import { PrismaService } from '../prisma/prisma.service';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export type Identifier = { kind: 'email'; value: string } | { kind: 'phone'; value: string };

export function parseIdentifier(raw: string): Identifier {
  const v = (raw ?? '').trim();
  if (v.includes('@')) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new BadRequestException('Enter a valid email address');
    return { kind: 'email', value: v.toLowerCase() };
  }
  const phone = normalisePhone(v);
  if (!/^[6-9]\d{9}$/.test(phone)) throw new BadRequestException('Enter a valid email address or Indian mobile number');
  return { kind: 'phone', value: phone };
}

export const publicUser = (u: User) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone });

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {
    if (!this.config.get('JWT_SECRET') && this.config.get('NODE_ENV') === 'production') {
      throw new Error('JWT_SECRET must be set in production');
    }
  }

  private get secret() {
    return this.config.get<string>('JWT_SECRET') ?? 'dev-secret-change-me';
  }
  private get isProd() {
    return this.config.get('NODE_ENV') === 'production';
  }

  // ---------------------------------------------------------------- tokens
  sign(user: User) {
    return jwt.sign({ sub: user.id }, this.secret, { expiresIn: '7d' });
  }

  async userFromHeader(authorization?: string): Promise<User | null> {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (!token) return null;
    try {
      const { sub } = jwt.verify(token, this.secret) as { sub: string };
      return await this.prisma.user.findUnique({ where: { id: sub } });
    } catch {
      return null;
    }
  }

  private session(user: User) {
    return { token: this.sign(user), user: publicUser(user) };
  }

  // ---------------------------------------------------------------- passwords (scrypt, per-user salt)
  private async hash(password: string) {
    const salt = randomBytes(16);
    return `scrypt$${salt.toString('hex')}$${(await scrypt(password, salt, 64)).toString('hex')}`;
  }
  private async verifyPassword(password: string, stored: string | null) {
    if (!stored) return false;
    const [, saltHex, hashHex] = stored.split('$');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), 64);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  // ---------------------------------------------------------------- register / login
  async register(dto: { firstName: string; lastName: string; identifier: string; password: string }) {
    const id = parseIdentifier(dto.identifier);
    const exists = await this.prisma.user.findUnique({ where: id.kind === 'email' ? { email: id.value } : { phone: id.value } });
    if (exists) throw new ConflictException('An account with this email or phone already exists. Try signing in.');
    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName.trim(), lastName: dto.lastName.trim(),
        email: id.kind === 'email' ? id.value : null, phone: id.kind === 'phone' ? id.value : null,
        passwordHash: await this.hash(dto.password),
      },
    });
    return this.session(user);
  }

  async login(identifier: string, password: string) {
    const id = parseIdentifier(identifier);
    const user = await this.prisma.user.findUnique({ where: id.kind === 'email' ? { email: id.value } : { phone: id.value } });
    // Same error and similar work whether or not the account exists (no account enumeration).
    const ok = await this.verifyPassword(password, user?.passwordHash ?? `scrypt$${'00'.repeat(16)}$${'00'.repeat(64)}`);
    if (!user || !ok) throw new UnauthorizedException('Incorrect email/phone or password');
    return this.session(user);
  }

  // ---------------------------------------------------------------- Google
  async google(idToken: string) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) throw new NotImplementedException({ code: 'GOOGLE_NOT_CONFIGURED', message: 'Google sign-in is not configured yet' });
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!res.ok) throw new UnauthorizedException('Google sign-in failed');
    const g = (await res.json()) as { aud: string; sub: string; email?: string; email_verified?: string; given_name?: string; family_name?: string };
    if (g.aud !== clientId || g.email_verified !== 'true' || !g.email) throw new UnauthorizedException('Google sign-in failed');
    const email = g.email.toLowerCase();
    let user = await this.prisma.user.findFirst({ where: { OR: [{ googleId: g.sub }, { email }] } });
    if (!user) {
      user = await this.prisma.user.create({ data: { firstName: g.given_name ?? 'Guest', lastName: g.family_name ?? '', email, googleId: g.sub } });
    } else if (!user.googleId) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { googleId: g.sub } });
    }
    return this.session(user);
  }

  // ---------------------------------------------------------------- one-time code login
  private hashCode(identifier: string, code: string) {
    return createHash('sha256').update(`${identifier}:${code}:${this.secret}`).digest('hex');
  }

  /**
   * Always answers { sent: true } so the response never reveals whether an account exists.
   * No SMS/email provider is connected yet: the code is written to the server log, and returned as
   * `devCode` outside production so the flow can be demoed. Wire a provider before launch.
   */
  async requestCode(identifier: string) {
    const id = parseIdentifier(identifier);
    const user = await this.prisma.user.findUnique({ where: id.kind === 'email' ? { email: id.value } : { phone: id.value } });
    const out: { sent: true; devCode?: string } = { sent: true };
    if (!user) return out;
    const recent = await this.prisma.loginCode.count({ where: { identifier: id.value, createdAt: { gt: new Date(Date.now() - 60_000) } } });
    if (recent >= 3) throw new BadRequestException('Too many requests. Please wait a minute.');
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.loginCode.create({ data: { identifier: id.value, codeHash: this.hashCode(id.value, code), expiresAt: new Date(Date.now() + 10 * 60_000) } });
    this.log.warn(`[DEV] Login code for ${id.value}: ${code} (no SMS/email provider configured)`);
    if (!this.isProd) out.devCode = code;
    return out;
  }

  async verifyCode(identifier: string, code: string) {
    const id = parseIdentifier(identifier);
    const row = await this.prisma.loginCode.findFirst({
      where: { identifier: id.value, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    const fail = () => new UnauthorizedException('Invalid or expired code');
    if (!row || row.attempts >= 5) throw fail();
    await this.prisma.loginCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    const a = Buffer.from(row.codeHash);
    const b = Buffer.from(this.hashCode(id.value, code));
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw fail();
    await this.prisma.loginCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
    const user = await this.prisma.user.findUnique({ where: id.kind === 'email' ? { email: id.value } : { phone: id.value } });
    if (!user) throw fail();
    return this.session(user);
  }
}
