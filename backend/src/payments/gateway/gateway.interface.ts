export interface CheckoutInput {
  orderId: string;
  orderNumber: string;
  amountPaise: number;
  customerName: string;
  customerPhone: string;
  returnUrl: string;
  expiresAt: Date;
}

export interface CheckoutResult {
  reference: string; // gateway-side id of the payment link / session
  checkoutUrl: string; // hosted checkout URL (validated against trusted hosts before use)
}

export interface QrInput {
  orderNumber: string;
  amountPaise: number;
  expiresAt: Date;
}

export interface QrResult {
  reference: string; // gateway-side id of the QR code
  qrImageUrl: string; // image of the QR (validated against trusted hosts before use)
}

export interface GatewayEvent {
  eventId: string;
  type: 'PAID' | 'FAILED' | 'EXPIRED' | 'IGNORED';
  reference: string;
  amountPaise: number;
  gatewayPaymentId?: string;
}

export interface PaymentGateway {
  readonly name: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Optional: single-use, fixed-amount UPI QR. */
  createQr?(input: QrInput): Promise<QrResult>;
  /** Must verify an HMAC over the EXACT raw request bytes, using a timing-safe compare. */
  verifySignature(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean;
  parseEvent(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): GatewayEvent;
}
