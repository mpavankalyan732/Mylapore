'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, getOrderToken } from '@/lib/api';

/**
 * DEMO ONLY: stands in for Razorpay/Cashfree hosted checkout when PAYMENT_PROVIDER=mock.
 * It does not confirm anything itself: it asks the API to send a SIGNED webhook, exactly like a real gateway.
 */
function MockCheckout() {
  const q = useSearchParams();
  const router = useRouter();
  const ref = q.get('ref') ?? '';
  const order = q.get('order') ?? '';
  const [busy, setBusy] = useState(false);

  async function finish(outcome: 'paid' | 'failed') {
    setBusy(true);
    try {
      await api(`/payments/mock/${encodeURIComponent(ref)}/complete`, { method: 'POST', body: JSON.stringify({ outcome }) });
    } finally {
      const token = getOrderToken(order);
      router.push(`/order/${order}?t=${token ?? ''}&from=checkout`);
    }
  }

  return (
    <div className="panel narrow center">
      <h1>Demo payment gateway</h1>
      <p className="muted">Simulates the hosted checkout page of Razorpay/Cashfree. Order {order}</p>
      <div className="hero-cta" style={{ justifyContent: 'center' }}>
        <button className="btn btn-lg" disabled={busy} onClick={() => finish('paid')}>Pay successfully</button>
        <button className="btn btn-lg btn-ghost" disabled={busy} onClick={() => finish('failed')}>Fail payment</button>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <div className="container section">
      <Suspense fallback={null}>
        <MockCheckout />
      </Suspense>
    </div>
  );
}
