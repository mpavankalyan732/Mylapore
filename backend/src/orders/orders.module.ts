import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OutboxModule } from '../outbox/outbox.module';
import { PaymentsModule } from '../payments/payments.module';
import { DemoProgressService } from './demo-progress.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [OutboxModule, PaymentsModule, AuthModule],
  controllers: [OrdersController],
  providers: [OrdersService, DemoProgressService],
  exports: [OrdersService],
})
export class OrdersModule {}
