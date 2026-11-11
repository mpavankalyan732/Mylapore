import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CreateReservationDto } from '../reservations/reservations.module';
import { AgentKeyGuard } from './agent.guard';
import { CreateAgentOrderDto, MenuQueryDto, OrderCancelDto, OrderLookupDto, ReservationLookupDto } from './agent.dto';
import { AgentService } from './agent.service';

const READ = { default: { limit: 300, ttl: 60_000 } };
const LOOKUP = { default: { limit: 60, ttl: 60_000 } }; // tighter: lookups take an order number + phone
const WRITE = { default: { limit: 20, ttl: 60_000 } };

/**
 * API consumed by Salesforce (Apex callouts from Agentforce actions and the restaurantOrdering LWC).
 * Auth: `x-api-key` header (AGENT_API_KEY). Customers never call this directly.
 */
@ApiTags('agent (Salesforce)')
@ApiSecurity('agent')
@UseGuards(AgentKeyGuard)
@Controller('agent')
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @Get('config') @Throttle(READ)
  config() { return this.agent.config_(); }

  @Get('menu') @Throttle(READ)
  menu(@Query() q: MenuQueryDto) { return this.agent.menu(q); }

  @Get('categories') @Throttle(READ)
  categories() { return this.agent.categories(); }

  @Get('items') @Throttle(READ)
  items(@Query() q: MenuQueryDto) { return this.agent.items(q); }

  @Get('items/:ref') @Throttle(READ)
  item(@Param('ref') ref: string) { return this.agent.item(ref); }

  @Post('orders') @Throttle(WRITE)
  @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Or send idempotencyKey in the body. 8-100 chars. Same key returns the same order.' })
  createOrder(@Body() dto: CreateAgentOrderDto, @Headers('idempotency-key') key?: string) { return this.agent.createOrder(dto, key); }

  @Post('orders/details') @HttpCode(200) @Throttle(LOOKUP)
  orderDetails(@Body() dto: OrderLookupDto) { return this.agent.orderDetails(dto.orderNumber, dto.customerPhone); }

  @Post('orders/status') @HttpCode(200) @Throttle(LOOKUP)
  orderStatus(@Body() dto: OrderLookupDto) { return this.agent.orderStatus(dto.orderNumber, dto.customerPhone); }

  @Post('orders/cancel') @HttpCode(200) @Throttle(WRITE)
  cancelOrder(@Body() dto: OrderCancelDto) { return this.agent.cancelOrder(dto.orderNumber, dto.customerPhone); }

  @Post('reservations') @Throttle(WRITE)
  createReservation(@Body() dto: CreateReservationDto) { return this.agent.createReservation(dto); }

  @Post('reservations/details') @HttpCode(200) @Throttle(LOOKUP)
  reservationDetails(@Body() dto: ReservationLookupDto) { return this.agent.reservationDetails(dto.reservationId, dto.customerPhone); }

  @Post('reservations/cancel') @HttpCode(200) @Throttle(WRITE)
  cancelReservation(@Body() dto: ReservationLookupDto) { return this.agent.cancelReservation(dto.reservationId, dto.customerPhone); }
}
