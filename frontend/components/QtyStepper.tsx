'use client';
import { MenuItem } from '@/lib/api';
import { useCart, useLang, useShop, useToast } from './Providers';

/**
 * ADD button that becomes a  −  qty  +  stepper once the item is in the cart (Swiggy/Zomato pattern).
 * − at quantity 1 removes the item. Never navigates away; the first add shows a toast with a View cart shortcut.
 * variant "overlay" is the compact pill that sits on the bottom edge of a dish photo.
 */
export default function QtyStepper({ item, size = 'md', name, variant = 'solid' }: { item: MenuItem; size?: 'sm' | 'md'; name: string; variant?: 'solid' | 'overlay' }) {
  const { t } = useLang();
  const { qtyOf, add, dec } = useCart();
  const { setCartOpen } = useShop();
  const { toast } = useToast();
  const qty = qtyOf(item.id);

  if (!item.isAvailable) return <span className={variant === 'overlay' ? 'unavail-pill' : 'btn btn-outline btn-' + size}>{t('unavailable')}</span>;

  if (qty === 0) {
    return (
      <button
        className={variant === 'overlay' ? 'add-pill' : `btn btn-accent btn-${size}`}
        onClick={() => { add(item); toast(`${name} added`, { label: 'View cart', onClick: () => setCartOpen(true) }); }}
        aria-label={`${t('add')} ${name}`}
      >
        {variant === 'overlay' ? t('add').toUpperCase() : t('add')}
      </button>
    );
  }
  return (
    <div className={`stepper stepper-${size} ${variant === 'overlay' ? 'stepper-overlay' : ''}`} role="group" aria-label={`Quantity of ${name}`}>
      <button onClick={() => dec(item.id)} aria-label={qty === 1 ? `Remove ${name} from cart` : `Decrease ${name}`}>−</button>
      <output aria-live="polite">{qty}</output>
      <button onClick={() => add(item)} aria-label={`Increase ${name}`} disabled={qty >= 50}>+</button>
    </div>
  );
}
