import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { FulfilmentType, Language, PaymentMethod } from '@prisma/client';

export class OrderItemDto {
  @IsUUID() menuItemId: string;
  @IsInt() @Min(1) @Max(50) quantity: number;
  @IsOptional() @IsString() @MaxLength(200) notes?: string;
}

export class CustomerDto {
  @IsString() @MaxLength(80) name: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\s-]/g, '') : value))
  @Matches(/^(\+?91)?[6-9]\d{9}$/, { message: 'phone must be a valid Indian mobile number' })
  phone: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsEnum(Language) language?: Language;
}

export class AddressDto {
  @IsString() @MaxLength(200) line1: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsOptional() @IsString() @MaxLength(100) landmark?: string;
  @Matches(/^\d{6}$/, { message: 'pincode must be 6 digits' }) pincode: string;
}

export class CreateOrderDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => OrderItemDto) items: OrderItemDto[];
  @ValidateNested() @Type(() => CustomerDto) customer: CustomerDto;
  @IsEnum(FulfilmentType) fulfilment: FulfilmentType;
  @IsEnum(PaymentMethod) paymentMethod: PaymentMethod;
  @IsOptional() @ValidateNested() @Type(() => AddressDto) address?: AddressDto;
  @IsOptional() @IsString() @MaxLength(300) notes?: string;
  /** Total the customer saw. If it differs from the server total the API answers 409 PRICE_CHANGED. */
  @IsOptional() @IsInt() @Min(0) expectedTotalPaise?: number;
}
