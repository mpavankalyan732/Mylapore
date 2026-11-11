'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, rupees } from '@/lib/api';
import { useAuth, useLang } from '@/components/Providers';
import type { Key } from '@/lib/i18n';

interface MyOrder {
  orderNumber: string; lookupToken: string; status: string; totalPaise: number; createdAt: string; fulfilment: string;
  items: { name: string; quantity: number }[];
}

export default function MyOrders() {
  const { user, ready } = useAuth();
  const { t } = useLang();
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    api<MyOrder[]>('/me/orders').then(setOrders).catch(() => setError(true));
  }, [user]);

  if (!ready) return <div className="container section" />;
  if (!user) {
    return (
      <div className="container section narrow center">
        <h1>My Orders</h1>
        <p className="muted">Sign in to see your orders. Guest orders can be tracked with the link shown after checkout.</p>
        <div className="hero-cta" style={{ justifyContent: 'center' }}>
          <Link href="/signin?next=/orders" className="btn btn-accent">Sign In</Link>
          <Link href="/signup?next=/orders" className="btn btn-outline">Create Account</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="container section narrow">
      <h1>My Orders</h1>
      {error && <p role="alert" className="alert">Could not load your orders.</p>}
      {orders?.length === 0 && <p className="muted">No orders yet. <Link href="/menu" className="link-btn">Browse the menu</Link></p>}
      <div className="stack">
        {orders?.map((o) => (
          <Link key={o.orderNumber} href={`/order/${o.orderNumber}?t=${o.lookupToken}`} className="panel order-row">
            <div><b>{o.orderNumber}</b><p className="muted small">{new Date(o.createdAt).toLocaleString('en-IN')} · {o.fulfilment.replace('_', ' ').toLowerCase()}</p>
              <p className="small">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</p></div>
            <div className="right"><b>{rupees(o.totalPaise)}</b><span className="chip">{t(`s_${o.status}` as Key)}</span></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
