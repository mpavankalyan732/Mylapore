import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';
import { CreateOrderDto } from '../orders/orders.dto';

const stripSpaces = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.replace(/[\s-]/g, '') : value);
const PHONE = /^(\+?91)?[6-9]\d{9}$/;

export class MenuQueryDto {
  /** Category id, slug or (part of) its name. */
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  /** Accepted for forward compatibility. The restaurant menu has no subcategories today (a warning is returned). */
  @IsOptional() @IsString() @MaxLength(100) subcategory?: string;
  /** Free-text search over names, descriptions and tags (all languages). */
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsIn(['true', 'false']) includeUnavailable?: 'true' | 'false';
}

export class CreateAgentOrderDto extends CreateOrderDto {
  /** Alternative to the Idempotency-Key header (8-100 chars). Retrying with the same key returns the same order. */
  @IsOptional() @IsString() @Length(8, 100) idempotencyKey?: string;
  /** The ordering card sets this so card / UPI QR can be chosen afterwards (POST /agent/orders/:n/payment). */
  @IsOptional() @IsBoolean() deferCheckout?: boolean;
}

export class OrderLookupDto {
  @IsString() @MaxLength(40) orderNumber: string;
  /** The phone number the order was placed with: this is the ownership check. */
  @Transform(stripSpaces) @Matches(PHONE, { message: 'customerPhone must be a valid Indian mobile number' }) customerPhone: string;
}

export class OrderCancelDto extends OrderLookupDto {
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}

export class ReservationLookupDto {
  @IsUUID() reservationId: string;
  @Transform(stripSpaces) @Matches(PHONE, { message: 'customerPhone must be a valid Indian mobile number' }) customerPhone: string;
}

export class StartPaymentDto {
  @Transform(stripSpaces) @Matches(PHONE, { message: 'customerPhone must be a valid Indian mobile number' }) customerPhone: string;
  @IsIn(['CARD', 'UPI_QR']) method: 'CARD' | 'UPI_QR';
}

export class PaymentStatusQueryDto {
  @Transform(stripSpaces) @Matches(PHONE, { message: 'phone must be a valid Indian mobile number' }) phone: string;
}
