import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { StaffGuard } from '../common/staff.guard';
import { OrdersService } from '../orders/orders.service';

class UpdateStatusDto {
  @IsEnum(OrderStatus) status: OrderStatus;
}

@ApiTags('kitchen')
@ApiSecurity('staff')
@UseGuards(StaffGuard)
@Controller('kitchen')
export class KitchenController {
  constructor(private readonly orders: OrdersService) {}

  /** Only CONFIRMED+ orders. Unpaid online orders are never returned. */
  @Get('orders')
  list() {
    return this.orders.listForKitchen();
  }

  @Patch('orders/:id/status')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStatusDto) {
    return this.orders.updateStatus(id, dto.status);
  }

  @Get('manager/summary')
  summary() {
    return this.orders.summary();
  }
}
