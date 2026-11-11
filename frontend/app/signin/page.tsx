'use client';
import { FormEvent, Suspense, useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import GoogleButton from '@/components/GoogleButton';
import Logo from '@/components/Logo';
import { useAuth } from '@/components/Providers';
import { api, ApiError, AuthUser } from '@/lib/api';

type Session = { token: string; user: AuthUser };

function SignIn() {
  const router = useRouter();
  const next = useSearchParams().get('next') || '/';
  const { setSession } = useAuth();
  const [mode, setMode] = useState<'password' | 'code'>('password');
  const [step, setStep] = useState<'ask' | 'verify'>('ask');
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const done = useCallback((token: string, user: AuthUser) => { setSession(token, user); router.push(next); }, [setSession, router, next]);
  const fail = (e: unknown) => {
    const m = e instanceof ApiError ? e.body?.message : null;
    setError(Array.isArray(m) ? m.join(', ') : m ?? 'Something went wrong. Please try again.');
    setBusy(false);
  };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      if (mode === 'password') {
        const s = await api<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ identifier: f.get('identifier'), password: f.get('password') }) });
        return done(s.token, s.user);
      }
      if (step === 'ask') {
        const r = await api<{ sent: true; devCode?: string }>('/auth/code/request', { method: 'POST', body: JSON.stringify({ identifier }) });
        setDevCode(r.devCode ?? null);
        setStep('verify');
        return setBusy(false);
      }
      const s = await api<Session>('/auth/code/verify', { method: 'POST', body: JSON.stringify({ identifier, code: String(f.get('code')).trim() }) });
      done(s.token, s.user);
    } catch (err) { fail(err); }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-logo"><Logo /></Link>
        <h1>{mode === 'code' ? 'Log in with a code' : 'Welcome back'}</h1>
        <p className="muted">{mode === 'code' ? 'We will send a one-time code to your email or phone.' : 'Sign in to order faster and track your orders.'}</p>

        {mode === 'password' && (
          <>
            <GoogleButton onSession={done} />
            <div className="or"><span>Or continue with</span></div>
          </>
        )}

        <form onSubmit={submit} className="stack">
          {error && <p role="alert" className="alert">{error}</p>}
          {mode === 'password' ? (
            <>
              <label>Email address or phone number<input name="identifier" required autoComplete="username" placeholder="name@example.com or 98765 43210" /></label>
              <label>Password<input name="password" type="password" required autoComplete="current-password" placeholder="Your password" /></label>
              <button className="btn btn-accent btn-lg" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
            </>
          ) : step === 'ask' ? (
            <>
              <label>Email address or phone number<input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoComplete="username" placeholder="name@example.com or 98765 43210" /></label>
              <button className="btn btn-accent btn-lg" disabled={busy}>{busy ? 'Sending…' : 'Send code'}</button>
            </>
          ) : (
            <>
              <p className="notice ok" role="status">If an account exists for <b>{identifier}</b>, a 6-digit code is on its way.</p>
              {devCode && <p className="notice dev">Demo mode: your code is <b>{devCode}</b>. SMS/email delivery is not connected yet.</p>}
              <label>6-digit code<input name="code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" placeholder="123456" autoFocus /></label>
              <button className="btn btn-accent btn-lg" disabled={busy}>{busy ? 'Checking…' : 'Verify and sign in'}</button>
              <button type="button" className="link-btn" onClick={() => { setStep('ask'); setDevCode(null); setError(null); }}>Use a different email or phone</button>
            </>
          )}
        </form>

        <div className="auth-foot">
          {mode === 'password'
            ? <p>Shopped with us before? <button className="link-btn" onClick={() => { setMode('code'); setStep('ask'); setError(null); }}>Log in with a code</button></p>
            : <p><button className="link-btn" onClick={() => { setMode('password'); setError(null); }}>← Back to password sign in</button></p>}
          <p>Don&apos;t have an account? <Link href={`/signup${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="link-btn">Create one</Link></p>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={null}><SignIn /></Suspense>;
}
