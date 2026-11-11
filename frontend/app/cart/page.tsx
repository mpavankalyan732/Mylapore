'use client';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, isSafeCheckoutUrl, rupees, saveOrderToken } from '@/lib/api';
import { VegMark } from '@/components/Header';
import { useAuth, useCart, useLang, useShop } from '@/components/Providers';
import QtyStepper from '@/components/QtyStepper';

type Fulfilment = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
type Method = 'ONLINE' | 'COD';
type Field = 'name' | 'phone' | 'line1' | 'pincode';

const PHONE_RE = /^(\+?91)?[6-9]\d{9}$/;
const clean = (s: string) => s.replace(/[\s-]/g, '');
const validators: Record<Field, (v: string) => string | null> = {
  name: (v) => (v.trim().length < 2 ? 'Please enter your name' : null),
  phone: (v) => (PHONE_RE.test(clean(v)) ? null : 'Enter a valid 10-digit Indian mobile number'),
  line1: (v) => (v.trim().length < 4 ? 'Enter your delivery address' : null),
  pincode: (v) => (/^\d{6}$/.test(v) ? null : 'Enter a 6-digit pincode'),
};

export default function Checkout() {
  const { t, lang } = useLang();
  const { lines, subtotalPaise, clear, markUnavailable } = useCart();
  const { user } = useAuth();
  const { cfg, pincode: savedPin } = useShop();
  const router = useRouter();
  const [fulfilment, setFulfilment] = useState<Fulfilment>('TAKEAWAY');
  const [method, setMethod] = useState<Method>('ONLINE');
  const [vals, setVals] = useState<Record<Field, string>>({ name: '', phone: '', line1: '', pincode: '' });
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [notes, setNotes] = useState('');
  const [landmark, setLandmark] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idemKey = useRef<string | null>(null);
  const prefilled = useRef(false);

  // Prefill once from the signed-in account / saved delivery location.
  useEffect(() => {
    if (prefilled.current) return;
    if (user || savedPin) {
      prefilled.current = true;
      setVals((v) => ({ ...v, name: v.name || (user ? `${user.firstName} ${user.lastName}`.trim() : ''), phone: v.phone || user?.phone || '', pincode: v.pincode || savedPin }));
    }
  }, [user, savedPin]);

  // A changed cart/selection is a different order: never reuse the previous idempotency key.
  const sig = lines.map((l) => `${l.item.id}:${l.qty}`).join('|') + fulfilment + method;
  useEffect(() => { idemKey.current = null; }, [sig]);

  const cod = cfg?.codEnabled ?? true;
  useEffect(() => { if (!cod && method === 'COD') setMethod('ONLINE'); }, [cod, method]);

  const tax = Math.round((subtotalPaise * (cfg?.taxPercent ?? 0)) / 100);
  const fee = fulfilment === 'DELIVERY' ? cfg?.deliveryFeePaise ?? 0 : 0;
  const total = subtotalPaise + tax + fee;

  const needed: Field[] = fulfilment === 'DELIVERY' ? ['name', 'phone', 'line1', 'pincode'] : ['name', 'phone'];
  const errors = useMemo(() => Object.fromEntries(needed.map((f) => [f, validators[f](vals[f])])) as Partial<Record<Field, string | null>>, [vals, fulfilment]); // eslint-disable-line react-hooks/exhaustive-deps
  const pinStatus = vals.pincode.length === 6 && cfg ? (cfg.servicePincodes.includes(vals.pincode) ? 'ok' : 'no') : null;
  const hasUnavailable = lines.some((l) => !l.item.isAvailable);
  const valid = needed.every((f) => !errors[f]) && (fulfilment !== 'DELIVERY' || pinStatus !== 'no');

  const set = (f: Field) => ({
    value: vals[f],
    onChange: (e: { target: { value: string } }) => setVals((v) => ({ ...v, [f]: f === 'pincode' ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value })),
    id: `f-${f}`,
    onBlur: () => setTouched((x) => ({ ...x, [f]: true })),
    'aria-invalid': touched[f] && errors[f] ? true : undefined,
    'aria-describedby': touched[f] && errors[f] ? `err-${f}` : undefined,
  });
  const fieldErr = (f: Field) => touched[f] && errors[f] ? <small id={`err-${f}`} className="field-err" role="alert">{errors[f]}</small> : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return; // duplicate-click guard (server-side idempotency is the real protection)
    if (!valid) {
      setTouched({ name: true, phone: true, line1: true, pincode: true });
      setError(pinStatus === 'no' ? t('err_area') : 'Please fix the highlighted fields.');
      const first = needed.find((f) => errors[f]);
      return void (first && document.getElementById(`f-${first}`)?.focus()); // focus the first invalid field (state is already known)
    }
    setBusy(true);
    setError(null);
    idemKey.current ??= crypto.randomUUID();
    try {
      const res = await api<{ orderNumber: string; lookupToken: string; checkoutUrl?: string }>('/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': idemKey.current },
        body: JSON.stringify({
          items: lines.map((l) => ({ menuItemId: l.item.id, quantity: l.qty })),
          customer: { name: vals.name.trim(), phone: clean(vals.phone), language: lang.toUpperCase() },
          fulfilment,
          paymentMethod: method,
          address: fulfilment === 'DELIVERY' ? { line1: vals.line1.trim(), pincode: vals.pincode, landmark: landmark.trim() || undefined } : undefined,
          notes: notes.trim() || undefined,
          expectedTotalPaise: total,
        }),
      });
      saveOrderToken(res.orderNumber, res.lookupToken);
      clear();
      if (res.checkoutUrl && isSafeCheckoutUrl(res.checkoutUrl)) window.location.assign(res.checkoutUrl); // hosted checkout
      else router.push(`/order/${res.orderNumber}?t=${res.lookupToken}`);
    } catch (err) {
      const body = err instanceof ApiError ? err.body : null;
      idemKey.current = null; // a rejected order may be retried as a fresh attempt
      if (body?.code === 'ITEM_UNAVAILABLE') { markUnavailable(body.itemIds); setError(t('err_unavailable')); }
      else if (body?.code === 'PRICE_CHANGED') setError(`${t('err_price')} (${rupees(body.newTotalPaise)})`);
      else if (body?.code === 'DELIVERY_OUT_OF_AREA') setError(t('err_area'));
      else setError(Array.isArray(body?.message) ? body.message.join(', ') : body?.message ?? t('err_generic'));
      setBusy(false);
    }
  }

  if (lines.length === 0) {
    return (
      <div className="container section narrow center">
        <div className="empty-art" aria-hidden="true">🛒</div>
        <h1>{t('empty_cart_t')}</h1>
        <p className="muted">{t('empty_cart_d')}</p>
        <Link href="/menu" className="btn btn-accent">{t('browse_menu')}</Link>
      </div>
    );
  }

  const OPTIONS: { key: Fulfilment; icon: string; label: string; desc: string }[] = [
    { key: 'DINE_IN', icon: '🍽️', label: t('dine_in'), desc: t('co_dine_d') },
    { key: 'TAKEAWAY', icon: '🥡', label: t('takeaway'), desc: t('co_take_d') },
    { key: 'DELIVERY', icon: '🛵', label: t('delivery'), desc: t('co_deliv_d') },
  ];

  return (
    <div className="container section">
      <h1>{t('co_title')}</h1>
      <ol className="progress" aria-label="Checkout steps"><li className="done">Cart</li><li className="now" aria-current="step">Details &amp; payment</li><li>Confirmation</li></ol>

      <form onSubmit={submit} noValidate className="co-layout">
        <div className="co-main">
          {error && <p role="alert" className="alert">{error}</p>}

          <section className="co-card" aria-labelledby="s1">
            <h2 id="s1"><span className="num">1</span> {t('co_details')}</h2>
            {!user && <p className="hint">{t('co_signin_hint')} <Link href="/signin?next=/cart" className="link-btn">{t('sign_in')}</Link></p>}
            <div className="two">
              <label>{t('name')}<input {...set('name')} autoComplete="name" maxLength={80} placeholder="Full name" />{fieldErr('name')}</label>
              <label>{t('phone')}<input {...set('phone')} type="tel" inputMode="numeric" autoComplete="tel" placeholder="98765 43210" />{fieldErr('phone')}</label>
            </div>
          </section>

          <section className="co-card" aria-labelledby="s2">
            <h2 id="s2"><span className="num">2</span> {t('co_how')}</h2>
            <div className="opt-cards" role="radiogroup" aria-labelledby="s2">
              {OPTIONS.map((o) => (
                <label key={o.key} className={`opt-card ${fulfilment === o.key ? 'on' : ''}`}>
                  <input type="radio" name="fulfilment" checked={fulfilment === o.key} onChange={() => setFulfilment(o.key)} />
                  <span className="oc-icon" aria-hidden="true">{o.icon}</span>
                  <span><b>{o.label}</b><small>{o.desc}</small></span>
                </label>
              ))}
            </div>
          </section>

          {fulfilment === 'DELIVERY' && (
            <section className="co-card" aria-labelledby="s3">
              <h2 id="s3"><span className="num">3</span> {t('co_address')}</h2>
              <label>{t('address_line')}<input {...set('line1')} autoComplete="street-address" maxLength={200} placeholder="House / flat, street, area" />{fieldErr('line1')}</label>
              <div className="two">
                <label>{t('pincode')}<input {...set('pincode')} inputMode="numeric" autoComplete="postal-code" placeholder="517501" />{fieldErr('pincode')}
                  {pinStatus === 'ok' && <small className="field-ok" role="status">✓ {t('co_pin_ok')}</small>}
                  {pinStatus === 'no' && <small className="field-err" role="alert">{t('co_pin_no')}</small>}
                </label>
                <label>{t('co_landmark')}<input value={landmark} onChange={(e) => setLandmark(e.target.value)} maxLength={100} placeholder="Near…" /></label>
              </div>
            </section>
          )}

          <section className="co-card" aria-labelledby="s4">
            <h2 id="s4"><span className="num">{fulfilment === 'DELIVERY' ? 4 : 3}</span> {t('co_payment')}</h2>
            <div className="opt-cards" role="radiogroup" aria-labelledby="s4">
              <label className={`opt-card ${method === 'ONLINE' ? 'on' : ''}`}>
                <input type="radio" name="method" checked={method === 'ONLINE'} onChange={() => setMethod('ONLINE')} />
                <span className="oc-icon" aria-hidden="true">💳</span><span><b>{t('pay_online')}</b><small>{t('co_online_d')}</small></span>
              </label>
              {cod && (
                <label className={`opt-card ${method === 'COD' ? 'on' : ''}`}>
                  <input type="radio" name="method" checked={method === 'COD'} onChange={() => setMethod('COD')} />
                  <span className="oc-icon" aria-hidden="true">💵</span><span><b>{t('pay_cod')}</b><small>{t('co_cod_d')}</small></span>
                </label>
              )}
            </div>
            {method === 'ONLINE' && <p className="secure">🔒 {t('co_secure')}</p>}
            <label>{t('notes')}<textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} rows={2} placeholder="Allergies, spice level, special requests…" /></label>
          </section>
        </div>

        <aside className="co-summary" aria-labelledby="sum">
          <h2 id="sum">{t('co_summary')}</h2>
          <ul className="sum-lines">
            {lines.map(({ item, qty }) => (
              <li key={item.id} className={item.isAvailable ? '' : 'line-off'}>
                <div><VegMark /> <b>{item.names[lang as keyof typeof item.names] || item.names.en}</b>{!item.isAvailable && <em className="small"> ({t('unavailable')})</em>}<p className="muted small">{rupees(item.pricePaise)} each</p></div>
                <QtyStepper item={item} size="sm" name={item.names.en} />
                <strong>{rupees(item.pricePaise * qty)}</strong>
              </li>
            ))}
          </ul>
          <dl className="bill">
            <div><dt>{t('subtotal')}</dt><dd>{rupees(subtotalPaise)}</dd></div>
            {tax > 0 && <div><dt>{t('tax')}</dt><dd>{rupees(tax)}</dd></div>}
            {fulfilment === 'DELIVERY' && <div><dt>{t('delivery_fee')}</dt><dd>{fee ? rupees(fee) : 'Free'}</dd></div>}
            <div className="bill-total"><dt>{t('total')}</dt><dd>{rupees(total)}</dd></div>
          </dl>
          <button className="btn btn-accent btn-lg btn-block" disabled={busy || hasUnavailable}>{busy ? t('placing') : `${t('co_place')} · ${rupees(total)}`}</button>
          {hasUnavailable && <p className="field-err small">Remove unavailable items to continue.</p>}
          <p className="muted small center">By placing your order you agree to be contacted about it on the number above.</p>
        </aside>
      </form>
    </div>
  );
}
