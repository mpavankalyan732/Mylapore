import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Param, Query, Post } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CreateAgentOrderDto } from './agent.dto';
import { AgentService } from './agent.service';
import { PublicChatCreateOrderDto, PublicChatPaymentStatusDto, PublicChatStartPaymentDto } from './public-chat.dto';

@ApiTags('public chat checkout')
@Controller('public/chat')
export class PublicChatController {
  constructor(private readonly agent: AgentService) {}

  @Post('orders')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Unique key for safe order retries (8-100 chars).' })
  createOrder(@Body() dto: PublicChatCreateOrderDto, @Headers('idempotency-key') key?: string) {
    if (!key || key.length < 8 || key.length > 100) throw new BadRequestException('Idempotency-Key header (8-100 chars) is required');
    return this.agent.createOrder({ ...dto, deferCheckout: true } as unknown as CreateAgentOrderDto, key);
  }

  @Post('orders/:orderNumber/payment')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async startPayment(@Param('orderNumber') orderNumber: string, @Body() dto: PublicChatStartPaymentDto) {
    return this.agent.startPayment(orderNumber, dto.phone, dto.method);
  }

  @Get('orders/:orderNumber/payment-status')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async paymentStatus(@Param('orderNumber') orderNumber: string, @Query() query: PublicChatPaymentStatusDto) {
    const status = await this.agent.paymentStatus(orderNumber, query.phone);
    return { status: status.status, amount: status.amount, ...(status.paidAt ? { paidAt: status.paidAt } : {}) };
  }
}
