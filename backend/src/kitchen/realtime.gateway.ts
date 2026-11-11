import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { safeEqual } from '../common/staff.guard';

/**
 * Rooms:  order:<orderId>  (customer tracking; needs orderNumber + lookupToken)
 *         kitchen          (staff; needs staff key)
 * Events: order.updated (order room + kitchen), kitchen.order.new (kitchen)
 * Scaling: add @socket.io/redis-adapter when running more than one API instance (Phase 2).
 */
@WebSocketGateway({ cors: { origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',') } })
export class RealtimeGateway {
  @WebSocketServer() server: Server;
  private readonly log = new Logger(RealtimeGateway.name);

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  @SubscribeMessage('order:subscribe')
  async subscribeOrder(@ConnectedSocket() client: Socket, @MessageBody() body: { orderNumber: string; token: string }) {
    const order = await this.prisma.order.findUnique({ where: { orderNumber: String(body?.orderNumber) } });
    if (!order || !safeEqual(order.lookupToken, String(body?.token ?? ''))) return { ok: false };
    await client.join(`order:${order.id}`);
    return { ok: true, status: order.status };
  }

  @SubscribeMessage('kitchen:subscribe')
  async subscribeKitchen(@ConnectedSocket() client: Socket, @MessageBody() body: { staffKey: string }) {
    const expected = this.config.get<string>('STAFF_API_KEY') ?? '';
    if (!expected || !safeEqual(String(body?.staffKey ?? ''), expected)) return { ok: false };
    await client.join('kitchen');
    return { ok: true };
  }

  emitOrderUpdated(order: { id: string; orderNumber: string; status: string; paymentStatus: string }) {
    const payload = { orderNumber: order.orderNumber, status: order.status, paymentStatus: order.paymentStatus };
    // Unpaid orders must not reach the kitchen room.
    const unpaid = ['PENDING_PAYMENT', 'PAYMENT_FAILED', 'EXPIRED'].includes(order.status);
    const rooms = unpaid ? [`order:${order.id}`] : [`order:${order.id}`, 'kitchen'];
    this.server?.to(rooms).emit('order.updated', payload);
  }

  emitKitchenNewOrder(order: { id: string; orderNumber: string }) {
    this.server?.to('kitchen').emit('kitchen.order.new', { orderId: order.id, orderNumber: order.orderNumber });
  }
}
