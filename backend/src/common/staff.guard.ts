import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** MVP staff auth via x-staff-key header. Replace with JWT + RBAC (Phase 2). */
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const key = String(req.headers['x-staff-key'] ?? '');
    const expected = this.config.get<string>('STAFF_API_KEY') ?? '';
    if (!expected || !safeEqual(key, expected)) throw new UnauthorizedException('Invalid staff key');
    return true;
  }
}
