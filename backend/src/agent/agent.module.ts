import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { AgentController } from './agent.controller';
import { AgentKeyGuard } from './agent.guard';
import { AgentService } from './agent.service';

@Module({
  imports: [OrdersModule, ReservationsModule],
  controllers: [AgentController],
  providers: [AgentService, AgentKeyGuard],
})
export class AgentModule {}
