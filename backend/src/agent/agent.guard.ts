import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { safeEqual } from '../common/staff.guard';

/**
 * Machine-to-machine auth for Salesforce (Apex via Named Credential + External Credential custom header).
 * Fails closed: if AGENT_API_KEY is not configured, every request is rejected.
 */
@Injectable()
export class AgentKeyGuard implements CanActivate {
  private readonly log = new Logger(AgentKeyGuard.name);
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const expected = this.config.get<string>('AGENT_API_KEY') ?? '';
    const given = String(ctx.switchToHttp().getRequest().headers['x-api-key'] ?? '');
    if (!expected) {
      this.log.error('AGENT_API_KEY is not set: rejecting agent API call');
      throw new UnauthorizedException('Agent API is not configured');
    }
    if (!given || !safeEqual(given, expected)) throw new UnauthorizedException('Invalid API key');
    return true;
  }
}
