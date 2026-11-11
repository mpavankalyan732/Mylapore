import { Body, Controller, Headers, HttpCode, Param, Post, RawBodyRequest, Req } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { IsIn } from 'class-validator';
import { Request } from 'express';
import { PaymentsService } from './payments.service';

class MockCompleteDto {
  @IsIn(['paid', 'failed']) outcome: 'paid' | 'failed';
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Gateway webhook. Signature is verified against the raw body (see main.ts rawBody: true). */
  @Post('webhook/:provider')
  @HttpCode(200)
  @SkipThrottle()
  webhook(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.payments.handleWebhook(provider, req.rawBody, headers);
  }

  /** Dev/demo only (404 in production or when PAYMENT_PROVIDER != mock). */
  @ApiExcludeEndpoint()
  @Post('mock/:reference/complete')
  @HttpCode(200)
  mockComplete(@Param('reference') reference: string, @Body() dto: MockCompleteDto) {
    return this.payments.completeMock(reference, dto.outcome);
  }
}
