import { createHmac, timingSafeEqual } from 'crypto';

export function hmacHex(secret: string, body: Buffer): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function verifyHmacHex(secret: string, body: Buffer, signature: string | undefined): boolean {
  if (!secret || !signature) return false;
  const expected = Buffer.from(hmacHex(secret, body), 'hex');
  let given: Buffer;
  try {
    given = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function header(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const v = headers[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}
