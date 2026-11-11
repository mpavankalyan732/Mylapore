'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { api, ApiError, rupees, WS_URL } from '@/lib/api';

interface KOrder {
  id: string; orderNumber: string; status: string; paymentMethod: string; paymentStatus: string; fulfilment: string;
  customerName: string; notes?: string | null; items: { name: string; quantity: number }[]; totalPaise: number; confirmedAt?: string | null;
}
interface Summary { confirmedOrders: number; confirmedValuePaise: number; ordersByStatus: Record<string, number> }

// UI hints only (not business rules): amber/red when an order has been waiting this many minutes.
const WARN_MIN = 15;
const LATE_MIN = 25;

const COLUMNS = [
  { key: 'new', title: 'New', hint: 'Paid or approved, waiting for the kitchen', statuses: ['CONFIRMED'] },
  { key: 'prep', title: 'Preparing', hint: 'On the stove', statuses: ['PREPARING'] },
  { key: 'ready', title: 'Ready', hint: 'Waiting for pickup, service or rider', statuses: ['READY', 'OUT_FOR_DELIVERY'] },
];

function nextAction(o: KOrder): { to: string; label: string } | null {
  switch (o.status) {
    case 'CONFIRMED': return { to: 'PREPARING', label: 'Start preparing' };
    case 'PREPARING': return { to: 'READY', label: 'Mark ready' };
    case 'READY': return o.fulfilment === 'DELIVERY' ? { to: 'OUT_FOR_DELIVERY', label: 'Out for delivery' } : { to: 'COMPLETED', label: o.fulfilment === 'DINE_IN' ? 'Served' : 'Handed over' };
    case 'OUT_FOR_DELIVERY': return { to: 'COMPLETED', label: 'Delivered' };
    default: return null;
  }
}
const minutesSince = (iso: string | null | undefined, now: number) => (iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000)) : 0);

/** Staff dashboard (MVP auth: shared staff key; replace with JWT/RBAC login in Phase 2). */
export default function Kitchen() {
  const [key, setKey] = useState('');
  const [authed, setAuthed] = useState(false);
  const [orders, setOrders] = useState<KOrder[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [sound, setSound] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const soundRef = useRef(false);
  const seen = useRef<Set<string>>(new Set());
  soundRef.current = sound;

  const beep = useCallback(() => {
    const ctx = audio.current;
    if (!ctx) return;
    [0, 0.22].forEach((d) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = d ? 1175 : 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + d); g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.18);
      o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.2);
    });
  }, []);

  const load = useCallback(async (k: string, first = false) => {
    try {
      const h = { 'x-staff-key': k };
      const [o, s] = await Promise.all([api<KOrder[]>('/kitchen/orders', { headers: h }), api<Summary>('/kitchen/manager/summary', { headers: h })]);
      const fresh = o.filter((x) => x.status === 'CONFIRMED' && !seen.current.has(x.id));
      o.forEach((x) => seen.current.add(x.id));
      if (!first && fresh.length) {
        setFlash(fresh.map((f) => f.orderNumber).join(', '));
        setTimeout(() => setFlash(null), 6000);
        if (soundRef.current) beep();
      }
      setOrders(o); setSummary(s); setAuthed(true); setError(null);
      sessionStorage.setItem('staffKey', k);
    } catch (e) {
      if (first || (e instanceof ApiError && e.status === 401)) { setAuthed(false); setError('Invalid staff key or API unreachable'); }
    }
  }, [beep]);

  useEffect(() => {
    const k = sessionStorage.getItem('staffKey');
    if (k) { setKey(k); void load(k, true); }
  }, [load]);

  // Realtime: socket events trigger a refresh; polling is the fallback when the socket is down.
  useEffect(() => {
    if (!authed) return;
    const k = sessionStorage.getItem('staffKey') ?? '';
    const socket: Socket = io(WS_URL, { transports: ['websocket', 'polling'], reconnection: true });
    socket.on('connect', () => { setLive(true); socket.emit('kitchen:subscribe', { staffKey: k }); void load(k); });
    socket.on('disconnect', () => setLive(false));
    const refresh = () => void load(k);
    socket.on('kitchen.order.new', refresh);
    socket.on('order.updated', refresh);
    const poll = setInterval(refresh, 20000);
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => { clearInterval(poll); clearInterval(tick); socket.disconnect(); };
  }, [authed, load]);

  async function move(o: KOrder, status: string) {
    if (status === 'CANCELLED' && !confirm(`Cancel order ${o.orderNumber}? This cannot be undone.`)) return;
    setBusyId(o.id);
    try {
      await api(`/kitchen/orders/${o.id}/status`, { method: 'PATCH', headers: { 'x-staff-key': key }, body: JSON.stringify({ status }) });
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? String(e.body?.message ?? 'Update failed') : 'Update failed');
    }
    setBusyId(null);
    void load(key);
  }

  function enableSound() {
    if (!sound) {
      audio.current ??= new AudioContext();
      void audio.current.resume();
      setSound(true);
      beep();
    } else setSound(false);
  }

  if (!authed) {
    return (
      <div className="container section narrow">
        <h1>Kitchen dashboard</h1>
        <form className="panel" onSubmit={(e) => { e.preventDefault(); void load(key, true); }}>
          {error && <p role="alert" className="alert">{error}</p>}
          <label>Staff key<input type="password" value={key} onChange={(e) => setKey(e.target.value)} required autoComplete="current-password" /></label>
          <button className="btn btn-accent">Sign in</button>
        </form>
      </div>
    );
  }

  return (
    <div className="container section kitchen">
      <div className="k-head">
        <div>
          <h1>Kitchen</h1>
          <p className="muted small"><span className={`live-dot ${live ? 'on' : ''}`} aria-hidden="true" /> {live ? 'Live: new orders appear instantly' : 'Reconnecting… refreshing every 20 seconds'}</p>
        </div>
        <div className="k-actions">
          <button className={`qchip ${sound ? 'on' : ''}`} aria-pressed={sound} onClick={enableSound}>{sound ? '🔔 Sound on' : '🔕 Sound off'}</button>
          <button className="qchip" onClick={() => { sessionStorage.removeItem('staffKey'); setAuthed(false); setKey(''); }}>Sign out</button>
        </div>
      </div>

      {flash && <p className="k-flash" role="status">🆕 New order: {flash}</p>}
      {error && <p role="alert" className="alert">{error}</p>}

      {summary && (
        <div className="kpis">
          <div><b>{summary.confirmedOrders}</b><span>Orders today</span></div>
          <div><b>{rupees(summary.confirmedValuePaise)}</b><span>Order value today</span></div>
          <div><b>{orders.length}</b><span>Active now</span></div>
          {Object.entries(summary.ordersByStatus).filter(([s]) => s === 'COMPLETED' || s === 'CANCELLED').map(([s, n]) => <div key={s}><b>{n}</b><span>{s.toLowerCase()}</span></div>)}
        </div>
      )}

      <div className="board">
        {COLUMNS.map((col) => {
          const list = orders.filter((o) => col.statuses.includes(o.status));
          return (
            <section key={col.key} className="b-col" aria-label={`${col.title} orders`}>
              <header><h2>{col.title} <span className="count">{list.length}</span></h2><p className="muted small">{col.hint}</p></header>
              {list.length === 0 && <p className="b-empty muted">Nothing here</p>}
              {list.map((o) => {
                const age = minutesSince(o.confirmedAt, now);
                const level = col.key !== 'ready' && age >= LATE_MIN ? 'late' : col.key !== 'ready' && age >= WARN_MIN ? 'warn' : '';
                const act = nextAction(o);
                const collect = o.paymentMethod === 'COD';
                return (
                  <article key={o.id} className={`k-card ${level}`}>
                    <header>
                      <strong>{o.orderNumber}</strong>
                      <span className={`age ${level}`} title="Time since confirmed">⏱ {age}m</span>
                    </header>
                    <div className="k-badges">
                      <span className="kb">{o.fulfilment.replace('_', ' ')}</span>
                      <span className={`kb ${collect ? 'kb-warn' : 'kb-ok'}`}>{collect ? `COLLECT ${rupees(o.totalPaise)}` : '✓ PAID ONLINE'}</span>
                    </div>
                    <ul className="k-items">{o.items.map((i, n) => <li key={n}><b>{i.quantity}×</b> {i.name}</li>)}</ul>
                    {o.notes && <p className="k-note">📝 {o.notes}</p>}
                    <p className="muted small">{o.customerName} · {rupees(o.totalPaise)}</p>
                    <div className="k-btns">
                      {act && <button className="btn btn-accent" disabled={busyId === o.id} onClick={() => move(o, act.to)}>{busyId === o.id ? '…' : act.label}</button>}
                      {(o.status === 'CONFIRMED' || o.status === 'PREPARING') && <button className="btn btn-outline btn-sm" disabled={busyId === o.id} onClick={() => move(o, 'CANCELLED')}>Cancel</button>}
                    </div>
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
