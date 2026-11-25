import { Body, Controller, Get, Headers, HttpCode, Module, NotFoundException, Post, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsNotEmpty, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AuthService, publicUser } from './auth.service';
import { ChatIdentity } from './chat-identity';

class RegisterDto {
  @IsString() @IsNotEmpty() @MaxLength(40) firstName: string;
  @IsString() @MaxLength(40) lastName: string;
  /** Email address OR Indian mobile number */
  @IsString() @MaxLength(120) identifier: string;
  @IsString() @MinLength(8) @MaxLength(72) password: string;
}
class LoginDto {
  @IsString() @MaxLength(120) identifier: string;
  @IsString() @MaxLength(72) password: string;
}
class GoogleDto {
  @IsString() @MaxLength(4000) idToken: string;
}
class CodeRequestDto {
  @IsString() @MaxLength(120) identifier: string;
}
class CodeVerifyDto {
  @IsString() @MaxLength(120) identifier: string;
  @IsString() @Length(6, 6) code: string;
}

const AUTH_LIMIT = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register') @Throttle(AUTH_LIMIT)
  register(@Body() dto: RegisterDto) { return this.auth.register(dto); }

  @Post('login') @HttpCode(200) @Throttle(AUTH_LIMIT)
  login(@Body() dto: LoginDto) { return this.auth.login(dto.identifier, dto.password); }

  @Post('google') @HttpCode(200) @Throttle(AUTH_LIMIT)
  google(@Body() dto: GoogleDto) { return this.auth.google(dto.idToken); }

  @Post('code/request') @HttpCode(200) @Throttle(AUTH_LIMIT)
  requestCode(@Body() dto: CodeRequestDto) { return this.auth.requestCode(dto.identifier); }

  @Post('code/verify') @HttpCode(200) @Throttle(AUTH_LIMIT)
  verifyCode(@Body() dto: CodeVerifyDto) { return this.auth.verifyCode(dto.identifier, dto.code); }

  @Get('me')
  async me(@Headers('authorization') authz?: string) {
    const user = await this.auth.userFromHeader(authz);
    if (!user) throw new UnauthorizedException();
    return publicUser(user);
  }
}

@ApiTags('me')
@Controller('me')
class MeController {
  private readonly chat: ChatIdentity;
  constructor(private readonly auth: AuthService, private readonly prisma: PrismaService, config: ConfigService) {
    this.chat = new ChatIdentity(config);
  }

  /** Short-lived signed identity for the Salesforce chat. 404 until CHAT_JWT_PRIVATE_KEY is set. Only for a signed-in customer. */
  @Get('chat-identity')
  async chatIdentity(@Headers('authorization') authz?: string) {
    if (!this.chat.enabled) throw new NotFoundException();
    const user = await this.auth.userFromHeader(authz);
    if (!user) throw new UnauthorizedException();
    return this.chat.sign(user);
  }

  /** Orders placed while signed in. Includes the tracking token because the caller owns these orders. */
  @Get('orders')
  async orders(@Headers('authorization') authz?: string) {
    const user = await this.auth.userFromHeader(authz);
    if (!user) throw new UnauthorizedException();
    const rows = await this.prisma.order.findMany({
      where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50, include: { items: true },
    });
    return rows.map((o) => ({
      orderNumber: o.orderNumber, lookupToken: o.lookupToken, status: o.status, paymentStatus: o.paymentStatus,
      fulfilment: o.fulfilment, totalPaise: o.totalPaise, createdAt: o.createdAt,
      items: o.items.map((i) => ({ name: i.nameSnapshot, quantity: i.quantity })),
    }));
  }
}

/** Public keys Salesforce uses to verify chat identity tokens. Contains no secret. */
@ApiTags('auth')
@Controller('.well-known')
class WellKnownController {
  private readonly chat: ChatIdentity;
  constructor(config: ConfigService) {
    this.chat = new ChatIdentity(config);
  }
  @Get('chat-jwks.json')
  jwks() {
    return this.chat.jwks();
  }
}

@Module({ controllers: [AuthController, MeController, WellKnownController], providers: [AuthService], exports: [AuthService] })
export class AuthModule {}
