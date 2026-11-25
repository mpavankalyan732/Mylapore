import { ConfigService } from '@nestjs/config';
import { createPublicKey } from 'crypto';
import * as jwt from 'jsonwebtoken';

/**
 * Signed identity for the Salesforce chat (Messaging "user verification").
 *
 * The browser never decides who the guest is: after the backend has verified the sign-in (password, code or Google ID
 * token) it signs a short-lived RS256 JWT. Salesforce checks the signature against our public key (JWKS), so another
 * visitor cannot forge or change the name. The token carries only a stable subject and the display name:
 * no email, no Google tokens, no passwords.
 *
 * Needs CHAT_JWT_PRIVATE_KEY (PEM, RS256) and optionally CHAT_JWT_KEY_ID / CHAT_JWT_ISSUER. Without a key the feature is off.
 */
export class ChatIdentity {
  constructor(private readonly config: ConfigService) {}

  private get pem(): string | undefined {
    const raw = this.config.get<string>('CHAT_JWT_PRIVATE_KEY');
    return raw ? raw.replace(/\\n/g, '\n') : undefined; // env vars often store the PEM on one line with \n
  }
  get enabled() {
    return !!this.pem;
  }
  get keyId() {
    return this.config.get<string>('CHAT_JWT_KEY_ID') ?? 'mylapore-chat-1';
  }
  get issuer() {
    return this.config.get<string>('CHAT_JWT_ISSUER') ?? 'https://mylapore-api.onrender.com';
  }

  sign(user: { id: string; firstName: string; lastName: string }, ttlSeconds = 300) {
    const key = this.pem;
    if (!key) throw new Error('CHAT_JWT_PRIVATE_KEY is not configured');
    const name = `${user.firstName} ${user.lastName}`.trim();
    return {
      expiresIn: ttlSeconds,
      token: jwt.sign({ name, given_name: user.firstName }, key, {
        algorithm: 'RS256', keyid: this.keyId, issuer: this.issuer, subject: user.id, expiresIn: ttlSeconds,
      }),
    };
  }

  /** Public half only, in JWKS form, for Salesforce to verify tokens. Never exposes the private key. */
  jwks() {
    const key = this.pem;
    if (!key) return { keys: [] };
    const pub = createPublicKey(key).export({ format: 'jwk' });
    return { keys: [{ ...pub, kid: this.keyId, use: 'sig', alg: 'RS256' }] };
  }
}
