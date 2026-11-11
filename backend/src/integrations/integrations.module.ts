import { Transform } from 'class-transformer';
import {
  CanActivate, Body, Controller, ExecutionContext, Injectable, Module, NotFoundException, Post, UseGuards, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { IsEnum, IsString, Matches, MaxLength } from 'class-validator';
import { safeEqual } from '../common/staff.guard';
import { normalisePhone } from '../orders/pricing';
import { OrdersModule } from '../orders/orders.module';
import { OrdersService } from '../orders/orders.service';
import { PaymentsModule } from '../payments/payments.module';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';

/** Shared-secret guard for Salesforce / Agentforce callouts (use Named Credentials + custom header on the SF side). */
@Injectable()
class IntegrationKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(ctx: ExecutionContext) {
    const key = String(ctx.switchToHttp().getRequest().headers['x-integration-key'] ?? '');
    const expected = this.config.get<string>('SALESFORCE_INBOUND_KEY') ?? '';
    if (!expected || !safeEqual(key, expected)) throw new UnauthorizedException();
    return true;
  }
}

class SfStatusDto {
  @IsString() @MaxLength(40) orderNumber: string;
  @IsEnum(OrderStatus) status: OrderStatus;
}

class AgentLookupDto {
  @IsString() @MaxLength(40) orderNumber: string;
  /** Verified phone of the authenticated Salesforce contact: used as the ownership check. */
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\s-]/g, '') : value))
  @Matches(/^(\+?91)?[6-9]\d{9}$/)
  customerPhone: string;
}

@ApiExcludeController()
@UseGuards(IntegrationKeyGuard)
@Controller('integrations')
class IntegrationsController {
  constructor(
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
    private readonly prisma: PrismaService,
  ) {}

  /** Salesforce -> Postgres: kitchen status changed in Salesforce. Same state machine + realtime fan-out as the kitchen UI. */
  @Post('salesforce/order-status')
  sfStatus(@Body() dto: SfStatusDto) {
    return this.orders.updateStatusByNumber(dto.orderNumber, dto.status);
  }

  /**
   * Agentforce action backend. Returns STRUCTURED output (never just chat text):
   * { found, status, paymentStatus, checkoutUrl? , action? }. The website chat widget opens `checkoutUrl` itself.
   * Order ownership: the order must belong to the customer phone verified by the agent.
   */
  @Post('agentforce/order-lookup')
  async lookup(@Body() dto: AgentLookupDto) {
    const order = await this.prisma.order.findUnique({ where: { orderNumber: dto.orderNumber }, include: { customer: true } });
    if (!order || order.customer.phone !== normalisePhone(dto.customerPhone)) throw new NotFoundException('Order not found');
    let checkoutUrl: string | undefined;
    if (order.status === 'PENDING_PAYMENT' && order.paymentMethod === 'ONLINE') {
      checkoutUrl = (await this.payments.ensureCheckout(order.id).catch(() => undefined))?.checkoutUrl;
    }
    return {
      found: true,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalPaise: order.totalPaise,
      checkoutUrl,
      action: checkoutUrl ? { type: 'OPEN_CHECKOUT', url: checkoutUrl } : undefined,
    };
  }
}

@Module({
  imports: [OrdersModule, PaymentsModule],
  controllers: [IntegrationsController],
  providers: [IntegrationKeyGuard],
})
export class IntegrationsModule {}
