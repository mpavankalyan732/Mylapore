'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { io } from 'socket.io-client';
import { api, getOrderToken, isSafeCheckoutUrl, rupees, saveOrderToken, WS_URL } from '@/lib/api';
import { useLang } from '@/components/Providers';
import type { Key } from '@/lib/i18n';

interface OrderView {
  orderNumber: string; status: string; paymentStatus: string; paymentMethod: string; totalPaise: number; checkoutUrl?: string;
  items: { name: string; quantity: number; lineTotalPaise: number }[];
}
const STEPS = ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'];

function Tracker() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const q = useSearchParams();
  const { t } = useLang();
  const [order, setOrder] = useState<OrderView | null>(null);
  const [missing, setMissing] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = q.get('t');
    if (fromUrl) saveOrderToken(orderNumber, fromUrl);
    setToken(fromUrl ?? getOrderToken(orderNumber));
  }, [orderNumber, q]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setOrder(await api<OrderView>(`/orders/${orderNumber}?token=${encodeURIComponent(token)}`));
    } catch {
      setMissing(true);
    }
  }, [orderNumber, token]);

  useEffect(() => {
    void load();
  }, [load]);

  // Real-time updates (Socket.IO) with a polling fallback.
  useEffect(() => {
    if (!token) return;
    const socket = io(WS_URL, { transports: ['websocket', 'polling'], reconnection: true });
    const sub = () => socket.emit('order:subscribe', { orderNumber, token });
    socket.on('connect', sub);
    socket.on('order.updated', (e: { orderNumber: string }) => e.orderNumber === orderNumber && void load());
    const poll = setInterval(() => void load(), 8000);
    return () => {
      clearInterval(poll);
      socket.disconnect();
    };
  }, [orderNumber, token, load]);

  if (!token || missing) return <p role="alert" className="alert">Order not found. Open the tracking link you received after ordering.</p>;
  if (!order) return <p>…</p>;

  const processing = order.status === 'PENDING_PAYMENT';
  const idx = STEPS.indexOf(order.status === 'OUT_FOR_DELIVERY' ? 'READY' : order.status);

  return (
    <>
      <h1>{t('order_status')}</h1>
      <p className="muted">{t('order_number')}: <strong>{order.orderNumber}</strong></p>

      {processing ? (
        // The return URL only ever shows "processing". Confirmation arrives via the signed webhook.
        <div className="panel processing" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <h2>{t('processing_payment')}</h2>
          <p>{t('processing_note')}</p>
          {order.checkoutUrl && isSafeCheckoutUrl(order.checkoutUrl) && (
            <a className="btn btn-ghost" href={order.checkoutUrl}>{t('retry_payment')}</a>
          )}
        </div>
      ) : (
        <div className="panel" aria-live="polite">
          <p className="status-now">{t(`s_${order.status}` as Key)}</p>
          {idx >= 0 && (
            <ol className="steps">
              {STEPS.map((s, i) => (
                <li key={s} className={i <= idx ? 'done' : ''}>{t(`s_${s}` as Key)}</li>
              ))}
            </ol>
          )}
        </div>
      )}

      <ul className="cart-lines compact">
        {order.items.map((i, n) => (
          <li key={n}><span>{i.name} × {i.quantity}</span><span>{rupees(i.lineTotalPaise)}</span></li>
        ))}
      </ul>
      <p className="grand">{t('total')}: {rupees(order.totalPaise)}</p>
    </>
  );
}

export default function OrderPage() {
  return (
    <div className="container section narrow">
      <Suspense fallback={<p>…</p>}>
        <Tracker />
      </Suspense>
    </div>
  );
}
