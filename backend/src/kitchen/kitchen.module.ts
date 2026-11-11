import { Global, Module } from '@nestjs/common';
import { KitchenController } from './kitchen.controller';
import { RealtimeGateway } from './realtime.gateway';
import { OrdersModule } from '../orders/orders.module';

@Global()
@Module({ imports: [OrdersModule], controllers: [KitchenController], providers: [RealtimeGateway], exports: [RealtimeGateway] })
export class KitchenModule {}
