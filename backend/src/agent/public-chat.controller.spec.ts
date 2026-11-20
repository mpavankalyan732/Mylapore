import 'reflect-metadata';
import { NotFoundException, ValidationPipe } from '@nestjs/common';
import { THROTTLER_LIMIT, THROTTLER_TTL } from '@nestjs/throttler/dist/throttler.constants';
import { AgentService } from './agent.service';
import { PublicChatController } from './public-chat.controller';
import { PublicChatCreateOrderDto } from './public-chat.dto';

describe('PublicChatController', () => {
  const agent = {
    createOrder: jest.fn(),
    startPayment: jest.fn(),
    paymentStatus: jest.fn(),
  } as unknown as AgentService;
  let controller: PublicChatController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PublicChatController(agent);
  });

  it('creates an order through shared service logic and defers checkout selection', async () => {
    const result = { orderNumber: 'VR1', subtotal: 100, total: 105 };
    jest.mocked(agent.createOrder).mockResolvedValue(result as never);
    const dto = {
      items: [{ menuItemId: '00000000-0000-4000-8000-000000000001', quantity: 2 }],
      customer: { name: 'Asha', phone: '9876543210' },
      fulfilment: 'TAKEAWAY', paymentMethod: 'ONLINE',
    } as unknown as PublicChatCreateOrderDto;

    await expect(controller.createOrder(dto, 'idempotency-123')).resolves.toEqual(result);
    expect(agent.createOrder).toHaveBeenCalledWith(expect.objectContaining({ deferCheckout: true }), 'idempotency-123');
  });

  it('passes ownership failures through as the same 404 for an unknown order or wrong phone', async () => {
    jest.mocked(agent.startPayment).mockRejectedValue(new NotFoundException('Order not found'));
    await expect(controller.startPayment('VR1', { phone: '9876543210', method: 'CARD' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('has separate rate limits on create, payment and status lookups', () => {
    const p = PublicChatController.prototype;
    expect(Reflect.getMetadata(THROTTLER_LIMIT + 'default', p.createOrder)).toBe(5);
    expect(Reflect.getMetadata(THROTTLER_TTL + 'default', p.createOrder)).toBe(60_000);
    expect(Reflect.getMetadata(THROTTLER_LIMIT + 'default', p.startPayment)).toBe(10);
    expect(Reflect.getMetadata(THROTTLER_LIMIT + 'default', p.paymentStatus)).toBe(30);
  });

  it('rejects client-supplied prices with the app whitelist validation policy', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    const payload = {
      items: [{ menuItemId: '00000000-0000-4000-8000-000000000001', quantity: 2, unitPrice: 1 }],
      customer: { name: 'Asha', phone: '9876543210' },
      fulfilment: 'TAKEAWAY', paymentMethod: 'ONLINE', totalPaise: 1,
    };
    await expect(pipe.transform(payload, { type: 'body', metatype: PublicChatCreateOrderDto })).rejects.toThrow();
  });
});
