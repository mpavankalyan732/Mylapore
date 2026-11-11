'use client';
import { FormEvent, useEffect, useState } from 'react';
import { CloseIcon, PinIcon } from './Icons';
import { useShop } from './Providers';

/** Delivery pincode check against the service area published by the API. Informational: it does not block ordering. */
export default function LocationModal() {
  const { locationOpen, setLocationOpen, pincode, setPincode, cfg } = useShop();
  const [value, setValue] = useState(pincode);
  const [result, setResult] = useState<'ok' | 'no' | null>(null);

  useEffect(() => { if (locationOpen) { setValue(pincode); setResult(null); } }, [locationOpen, pincode]);
  useEffect(() => {
    if (!locationOpen) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setLocationOpen(false);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [locationOpen, setLocationOpen]);

  if (!locationOpen) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(value)) return setResult('no');
    setPincode(value);
    const ok = !!cfg?.servicePincodes.includes(value);
    setResult(ok ? 'ok' : 'no');
    if (ok) setTimeout(() => setLocationOpen(false), 900);
  }

  return (
    <div className="modal-back" onClick={() => setLocationOpen(false)}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="loc-title" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={() => setLocationOpen(false)} aria-label="Close"><CloseIcon /></button>
        <PinIcon width={30} height={30} />
        <h2 id="loc-title">Where should we deliver?</h2>
        <p className="muted">Enter your 6-digit pincode to check home delivery. Dine-in and takeaway are always available.</p>
        <form onSubmit={submit} className="stack">
          <input value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="Pincode, e.g. 517501" aria-label="Pincode" autoFocus />
          <button className="btn btn-accent">Check delivery</button>
        </form>
        {result === 'ok' && <p className="notice ok" role="status">✓ We deliver to {value}.</p>}
        {result === 'no' && <p className="notice no" role="status">Sorry, we do not deliver to this pincode yet. You can still dine in or take away.</p>}
      </div>
    </div>
  );
}
