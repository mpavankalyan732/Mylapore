import { OrderStatus } from '@prisma/client';

/** Allowed kitchen/manager transitions. PENDING_PAYMENT is only left via a verified webhook. */
export const STATUS_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'COMPLETED'],
  OUT_FOR_DELIVERY: ['COMPLETED'],
};

export const KITCHEN_VISIBLE: OrderStatus[] = ['CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
