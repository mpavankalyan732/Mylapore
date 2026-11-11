import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { StaffGuard } from '../common/staff.guard';
import { MenuService } from './menu.service';

class UpdateMenuItemDto {
  @IsOptional() @IsBoolean() isAvailable?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(10_000_000) pricePaise?: number;
}

@ApiTags('menu')
@Controller('menu')
export class MenuController {
  constructor(private readonly menu: MenuService, private readonly config: ConfigService) {}

  /** Public checkout config so the UI can show the same totals the server will compute. */
  @Get('config')
  publicConfig() {
    return {
      taxPercent: Number(this.config.get('TAX_PERCENT') ?? 0),
      deliveryFeePaise: Number(this.config.get('DELIVERY_FEE_PAISE') ?? 0),
      codEnabled: this.config.get('COD_ENABLED') === 'true',
      paymentProvider: this.config.get('PAYMENT_PROVIDER') ?? 'mock',
      servicePincodes: (this.config.get<string>('SERVICE_PINCODES') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
      googleClientId: this.config.get('GOOGLE_CLIENT_ID') ?? null,
    };
  }

  @Get()
  list() {
    return this.menu.getMenu();
  }

  @Get('items/:slug')
  item(@Param('slug') slug: string) {
    return this.menu.getItem(slug);
  }

  @ApiSecurity('staff')
  @UseGuards(StaffGuard)
  @Patch('items/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMenuItemDto) {
    return this.menu.update(id, dto);
  }
}
