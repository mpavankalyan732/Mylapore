'use client';
import { FormEvent, Suspense, useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import GoogleButton from '@/components/GoogleButton';
import Logo from '@/components/Logo';
import { useAuth } from '@/components/Providers';
import { api, ApiError, AuthUser } from '@/lib/api';

function SignUp() {
  const router = useRouter();
  const next = useSearchParams().get('next') || '/';
  const { setSession } = useAuth();
  const [via, setVia] = useState<'email' | 'phone'>('email');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const done = useCallback((token: string, user: AuthUser) => { setSession(token, user); router.push(next); }, [setSession, router, next]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const s = await api<{ token: string; user: AuthUser }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ firstName: f.get('firstName'), lastName: f.get('lastName'), identifier: f.get('identifier'), password: f.get('password') }),
      });
      done(s.token, s.user);
    } catch (err) {
      const m = err instanceof ApiError ? err.body?.message : null;
      setError(Array.isArray(m) ? m.join(', ') : m ?? 'Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-logo"><Logo /></Link>
        <h1>Create an account</h1>
        <p className="muted">Create an account to order faster and keep track of your orders.</p>

        <GoogleButton onSession={done} />
        <div className="or"><span>Or continue with</span></div>

        <form onSubmit={submit} className="stack">
          {error && <p role="alert" className="alert">{error}</p>}
          <div className="two">
            <label>First name<input name="firstName" required maxLength={40} autoComplete="given-name" placeholder="John" /></label>
            <label>Last name<input name="lastName" maxLength={40} autoComplete="family-name" placeholder="Doe" /></label>
          </div>
          <div className="seg" role="tablist" aria-label="Sign up with">
            <button type="button" role="tab" aria-selected={via === 'email'} className={via === 'email' ? 'on' : ''} onClick={() => setVia('email')}>Email</button>
            <button type="button" role="tab" aria-selected={via === 'phone'} className={via === 'phone' ? 'on' : ''} onClick={() => setVia('phone')}>Phone</button>
          </div>
          {via === 'email'
            ? <label className="sr-only-label">Email<input key="e" name="identifier" type="email" required autoComplete="email" placeholder="name@example.com" aria-label="Email" /></label>
            : <label className="sr-only-label">Phone<input key="p" name="identifier" type="tel" required inputMode="numeric" pattern="(\+?91)?[\s-]?[6-9][0-9\s-]{9,12}" autoComplete="tel" placeholder="98765 43210" aria-label="Phone" /></label>}
          <label>Password<input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" placeholder="Create a password" /></label>
          <p className="muted small">At least 8 characters.</p>
          <button className="btn btn-accent btn-lg" disabled={busy}>{busy ? 'Creating…' : 'Create Account'}</button>
        </form>

        <div className="auth-foot"><p>Already have an account? <Link href="/signin" className="link-btn">Sign in</Link></p></div>
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={null}><SignUp /></Suspense>;
}
