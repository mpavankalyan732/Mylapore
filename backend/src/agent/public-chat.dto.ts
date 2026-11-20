import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { FulfilmentType, PaymentMethod } from '@prisma/client';

const stripSpaces = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.replace(/[\s-]/g, '') : value);

export class PublicChatOrderItemDto {
  @IsUUID() menuItemId: string;
  @IsInt() @Min(1) @Max(20) quantity: number;
  @IsOptional() @IsString() @MaxLength(200) notes?: string;
}

export class PublicChatCustomerDto {
  @IsString() @Length(2, 80) name: string;
  @Transform(stripSpaces) @Matches(/^[6-9]\d{9}$/, { message: 'phone must be a valid 10-digit Indian mobile number' }) phone: string;
}

export class PublicChatAddressDto {
  @IsString() @MaxLength(200) line1: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsOptional() @IsString() @MaxLength(100) landmark?: string;
  @Matches(/^\d{6}$/) pincode: string;
}

/** Intentionally excludes price/total fields: the server always calculates the charge. */
export class PublicChatCreateOrderDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => PublicChatOrderItemDto) items: PublicChatOrderItemDto[];
  @ValidateNested() @Type(() => PublicChatCustomerDto) customer: PublicChatCustomerDto;
  @IsEnum(FulfilmentType) fulfilment: FulfilmentType;
  @IsEnum(PaymentMethod) paymentMethod: PaymentMethod;
  @IsOptional() @ValidateNested() @Type(() => PublicChatAddressDto) address?: PublicChatAddressDto;
  @IsOptional() @IsString() @MaxLength(300) notes?: string;
  @IsOptional() @IsBoolean() deferCheckout?: boolean;
}

export class PublicChatStartPaymentDto {
  @Transform(stripSpaces) @Matches(/^[6-9]\d{9}$/, { message: 'phone must be a valid 10-digit Indian mobile number' }) phone: string;
  @IsIn(['CARD', 'UPI_QR']) method: 'CARD' | 'UPI_QR';
}

export class PublicChatPaymentStatusDto {
  @Transform(stripSpaces) @Matches(/^[6-9]\d{9}$/, { message: 'phone must be a valid 10-digit Indian mobile number' }) phone: string;
}

