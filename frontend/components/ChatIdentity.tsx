'use client';
import { useEffect, useRef } from 'react';
import { API_URL, TOKEN_KEY } from '@/lib/api';
import { useAuth } from './Providers';

/**
 * Hands a signed-in customer's verified identity to the Salesforce chat. AgentforceChat embeds the widget; this only
 * adds the identity. The name is never taken from browser JavaScript: the backend signs a short-lived token
 * (backend/src/auth/chat-identity.ts) and Salesforce verifies the signature. No Google or session tokens go to Salesforce.
 * It does nothing until the backend has CHAT_JWT_PRIVATE_KEY (the endpoint answers 404) and Salesforce user verification is on.
 */
type VerificationApi = { setIdentityToken: (t: { identityTokenType: 'JWT'; identityToken: string }) => void; clearSession?: (clearCookies?: boolean) => void };
const verificationApi = (): VerificationApi | undefined =>
  (window as unknown as { embeddedservice_bootstrap?: { userVerificationAPI?: VerificationApi } }).embeddedservice_bootstrap?.userVerificationAPI;

export default function ChatIdentity() {
  const { user, ready } = useAuth();
  const chatReady = useRef(false);
  const sentFor = useRef<string | null>(null);

  const send = async () => {
    const api = verificationApi();
    if (!api || !chatReady.current) return;
    let token: string | null = null;
    try { token = localStorage.getItem(TOKEN_KEY); } catch {}
    if (!user || !token) {
      if (sentFor.current) api.clearSession?.(false); // signed out: end the verified chat identity
      sentFor.current = null;
      return;
    }
    if (sentFor.current === user.id) return;
    try {
      const res = await fetch(`${API_URL}/me/chat-identity`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return; // feature off (404) or session expired: the guest simply chats as a guest
      const { token: identityToken } = (await res.json()) as { token: string };
      api.setIdentityToken({ identityTokenType: 'JWT', identityToken });
      sentFor.current = user.id;
    } catch {
      /* the chat still works as a guest */
    }
  };

  useEffect(() => {
    const onReady = () => { chatReady.current = true; void send(); };
    window.addEventListener('onEmbeddedMessagingReady', onReady);
    return () => window.removeEventListener('onEmbeddedMessagingReady', onReady);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (ready) void send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, ready]);

  return null;
}
