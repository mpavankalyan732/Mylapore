import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../auth/auth.service';
import { CreateOrderDto } from './orders.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService, private readonly auth: AuthService) {}

  /**
   * Create an order. Online orders return a hosted `checkoutUrl`; the order is PENDING_PAYMENT until a
   * signed webhook confirms payment. COD orders are CONFIRMED immediately.
   */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiHeader({ name: 'Idempotency-Key', description: 'Client-generated unique key (8-100 chars). Retries with the same key return the same order.' })
  async create(@Body() dto: CreateOrderDto, @Headers('idempotency-key') key?: string, @Headers('authorization') authz?: string) {
    if (!key || key.length < 8 || key.length > 100) throw new BadRequestException('Idempotency-Key header (8-100 chars) is required');
    const user = await this.auth.userFromHeader(authz); // optional: guests may still order
    return this.orders.create(dto, key, user?.id);
  }

  /** Guest tracking: needs the secret token that was returned at creation. */
  @Get(':orderNumber')
  get(@Param('orderNumber') orderNumber: string, @Query('token') token: string) {
    return this.orders.getForCustomer(orderNumber, token);
  }
}
