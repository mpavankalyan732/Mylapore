'use client';
import { FormEvent, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/components/Providers';

export default function Reservations() {
  const { t } = useLang();
  const [state, setState] = useState<'idle' | 'busy' | 'ok'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState('busy');
    setError(null);
    try {
      await api('/reservations', {
        method: 'POST',
        body: JSON.stringify({
          customer: { name: f.get('name'), phone: f.get('phone') },
          partySize: Number(f.get('partySize')),
          startsAt: new Date(String(f.get('startsAt'))).toISOString(),
          notes: f.get('notes') || undefined,
        }),
      });
      setState('ok');
    } catch (err) {
      const m = err instanceof ApiError ? err.body?.message : null;
      setError(Array.isArray(m) ? m.join(', ') : m ?? t('err_generic'));
      setState('idle');
    }
  }

  return (
    <div className="container section narrow">
      <h1>{t('reserve_title')}</h1>
      {state === 'ok' ? (
        <p className="panel" role="status">{t('reserved_ok')}</p>
      ) : (
        <form onSubmit={submit} className="panel">
          {error && <p role="alert" className="alert">{error}</p>}
          <label>{t('name')}<input name="name" required maxLength={80} autoComplete="name" /></label>
          <label>{t('phone')}<input name="phone" required inputMode="numeric" pattern="(\+?91)?[6-9][0-9]{9}" autoComplete="tel" /></label>
          <label>{t('party_size')}<input name="partySize" type="number" min={1} max={60} defaultValue={2} required /></label>
          <label>{t('date_time')}<input name="startsAt" type="datetime-local" required /></label>
          <label>{t('notes')}<textarea name="notes" maxLength={300} rows={2} /></label>
          <button className="btn btn-lg" disabled={state === 'busy'}>{t('submit')}</button>
        </form>
      )}
    </div>
  );
}
