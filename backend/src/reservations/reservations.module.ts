import { Body, Controller, Injectable, Module, NotFoundException, Post, UnprocessableEntityException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { normalisePhone } from '../orders/pricing';
import { OutboxModule } from '../outbox/outbox.module';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';

export class ReservationCustomerDto {
  @IsString() @MaxLength(80) name: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\s-]/g, '') : value))
  @Matches(/^(\+?91)?[6-9]\d{9}$/)
  phone: string;
}

export class CreateReservationDto {
  @ValidateNested() @Type(() => ReservationCustomerDto) customer: ReservationCustomerDto;
  @IsInt() @Min(1) @Max(60) partySize: number;
  @IsDateString() startsAt: string;
  @IsOptional() @IsString() @MaxLength(300) notes?: string;
}

@Injectable()
export class ReservationsService {
  constructor(private readonly prisma: PrismaService, private readonly outbox: OutboxService) {}

  async create(dto: CreateReservationDto) {
    const startsAt = new Date(dto.startsAt);
    if (startsAt.getTime() < Date.now()) throw new UnprocessableEntityException('Reservation time must be in the future');
    return this.prisma.$transaction(async (tx) => {
      const phone = normalisePhone(dto.customer.phone);
      const customer = await tx.customer.upsert({
        where: { phone },
        update: { name: dto.customer.name },
        create: { phone, name: dto.customer.name },
      });
      const r = await tx.reservation.create({ data: { customerId: customer.id, partySize: dto.partySize, startsAt, notes: dto.notes } });
      await this.outbox.enqueue(tx, 'RESERVATION', r.id, 'RESERVATION_REQUESTED', {
        partySize: r.partySize, startsAt: r.startsAt.toISOString(), customerName: customer.name, customerPhone: customer.phone,
      });
      return { id: r.id, status: r.status, startsAt: r.startsAt, partySize: r.partySize };
    });
  }

  /** Ownership = the reservation's customer phone. Wrong phone and unknown id give the same 404. */
  async findOwned(id: string, phone: string) {
    const r = await this.prisma.reservation.findUnique({ where: { id }, include: { customer: true } });
    if (!r || r.customer.phone !== normalisePhone(phone)) throw new NotFoundException('Reservation not found');
    return r;
  }

  /** Cancels a future REQUESTED/CONFIRMED reservation. Never reports success unless the change was saved. */
  async cancelByCustomer(id: string, phone: string) {
    const r = await this.findOwned(id, phone);
    if (r.status === 'CANCELLED') return { cancelled: false, code: 'ALREADY_CANCELLED', message: 'The reservation is already cancelled.', reservation: r };
    if (r.startsAt.getTime() < Date.now()) return { cancelled: false, code: 'IN_THE_PAST', message: 'This reservation time has already passed.', reservation: r };
    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.reservation.updateMany({ where: { id: r.id, status: r.status }, data: { status: 'CANCELLED' } });
      if (res.count === 0) throw new UnprocessableEntityException('The reservation changed while cancelling. Please check it and try again.');
      await this.outbox.enqueue(tx, 'RESERVATION', r.id, 'RESERVATION_CANCELLED', {
        partySize: r.partySize, startsAt: r.startsAt.toISOString(), customerName: r.customer.name, customerPhone: r.customer.phone,
      });
      return tx.reservation.findUniqueOrThrow({ where: { id: r.id }, include: { customer: true } });
    });
    return { cancelled: true, code: 'CANCELLED', message: 'Reservation cancelled.', reservation: updated };
  }
}

@ApiTags('reservations')
@Controller('reservations')
class ReservationsController {
  constructor(private readonly svc: ReservationsService) {}

  /** Creates a reservation REQUEST. Availability/table rules are not defined yet (needs management input). */
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(@Body() dto: CreateReservationDto) {
    return this.svc.create(dto);
  }
}

@Module({ imports: [OutboxModule], controllers: [ReservationsController], providers: [ReservationsService], exports: [ReservationsService] })
export class ReservationsModule {}
