import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({ imports: [PaymentsModule], controllers: [MenuController], providers: [MenuService], exports: [MenuService] })
export class MenuModule {}
