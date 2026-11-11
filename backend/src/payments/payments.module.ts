import { Module } from '@nestjs/common';
import { OutboxModule } from '../outbox/outbox.module';
import { MockGateway } from './gateway/mock.gateway';
import { RazorpayGateway } from './gateway/razorpay.gateway';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [OutboxModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, RazorpayGateway, MockGateway],
  exports: [PaymentsService],
})
export class PaymentsModule {}
