import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { ChatIdentity } from '../auth/chat-identity';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const cfg = (o: Record<string, string>) => ({ get: (k: string) => o[k] }) as unknown as ConfigService;

describe('chat identity token', () => {
  const ident = new ChatIdentity(cfg({ CHAT_JWT_PRIVATE_KEY: privateKey.replace(/\n/g, '\\n') }));
  const user = { id: 'user-1', firstName: 'Pavan', lastName: 'Kalyan' };

  it('is off without a key', () => {
    const off = new ChatIdentity(cfg({}));
    expect(off.enabled).toBe(false);
    expect(off.jwks()).toEqual({ keys: [] });
    expect(() => off.sign(user)).toThrow();
  });

  it('signs a short-lived RS256 token with only the subject and display name', () => {
    const { token, expiresIn } = ident.sign(user);
    expect(expiresIn).toBe(300);
    const decoded = jwt.decode(token, { complete: true }) as jwt.Jwt & { payload: Record<string, unknown> };
    expect(decoded.header.alg).toBe('RS256');
    expect(decoded.header.kid).toBe('mylapore-chat-1');
    expect(decoded.payload.sub).toBe('user-1');
    expect(decoded.payload.name).toBe('Pavan Kalyan');
    expect(Object.keys(decoded.payload).sort()).toEqual(['exp', 'given_name', 'iat', 'iss', 'name', 'sub']); // no email, phone or Google data
    expect((decoded.payload.exp as number) - (decoded.payload.iat as number)).toBe(300);
  });

  it('publishes only the PUBLIC key, and it verifies the token', () => {
    const { token } = ident.sign(user);
    const jwk = ident.jwks().keys[0] as Record<string, string>;
    expect(jwk.kid).toBe('mylapore-chat-1');
    expect(jwk.d).toBeUndefined(); // the private exponent must never be published
    expect(jwk.p).toBeUndefined();
    const { createPublicKey } = jest.requireActual('crypto');
    const pem = createPublicKey({ key: jwk, format: 'jwk' }).export({ type: 'spki', format: 'pem' });
    expect((jwt.verify(token, pem, { algorithms: ['RS256'] }) as jwt.JwtPayload).sub).toBe('user-1');
  });

  it('rejects a token signed with a different key', () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
    const forged = jwt.sign({ name: 'Admin' }, other.privateKey, { algorithm: 'RS256', subject: 'user-1' });
    const jwk = ident.jwks().keys[0];
    const { createPublicKey } = jest.requireActual('crypto');
    const pem = createPublicKey({ key: jwk, format: 'jwk' }).export({ type: 'spki', format: 'pem' });
    expect(() => jwt.verify(forged, pem, { algorithms: ['RS256'] })).toThrow();
  });
});
