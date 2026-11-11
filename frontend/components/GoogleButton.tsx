'use client';
import { useEffect, useRef, useState } from 'react';
import { api, AuthUser } from '@/lib/api';
import { GoogleIcon } from './Icons';
import { useShop } from './Providers';

declare global {
  interface Window { google?: { accounts: { id: { initialize: (c: object) => void; renderButton: (el: HTMLElement, o: object) => void } } } }
}

/**
 * "Continue with Google". When the API reports a GOOGLE_CLIENT_ID this renders Google's official button
 * (Google Identity Services) and exchanges the ID token with our API. Without a client ID it explains why it is inactive.
 */
export default function GoogleButton({ label = 'Continue with Google', onSession }: { label?: string; onSession: (token: string, user: AuthUser) => void }) {
  const { cfg } = useShop();
  const holder = useRef<HTMLDivElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const clientId = cfg?.googleClientId;

  useEffect(() => {
    if (!clientId || !holder.current) return;
    const init = () => {
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: async (res: { credential: string }) => {
          try {
            const s = await api<{ token: string; user: AuthUser }>('/auth/google', { method: 'POST', body: JSON.stringify({ idToken: res.credential }) });
            onSession(s.token, s.user);
          } catch { setMsg('Google sign-in failed. Please try again or use email.'); }
        },
      });
      if (holder.current) window.google?.accounts.id.renderButton(holder.current, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', width: holder.current.offsetWidth });
    };
    if (window.google) return init();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = init;
    document.head.appendChild(s);
  }, [clientId, onSession]);

  if (clientId) return <div ref={holder} className="google-holder" aria-label={label} />;
  return (
    <>
      <button type="button" className="btn btn-google" onClick={() => setMsg('Google sign-in is not set up yet. Please continue with your email or phone number.')}>
        <GoogleIcon /> {label}
      </button>
      {msg && <p className="notice no" role="status">{msg}</p>}
    </>
  );
}
