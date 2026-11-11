'use client';
import { usePathname } from 'next/navigation';
import { rupees } from '@/lib/api';
import { CartIcon } from './Icons';
import { useCart, useLang, useShop } from './Providers';

const HIDE = ['/cart', '/order', '/kitchen', '/pay', '/signin', '/signup'];

/** Always-visible cart summary so adding items never forces a jump to the cart page. */
export default function FloatingCart() {
  const { count, subtotalPaise } = useCart();
  const { setCartOpen } = useShop();
  const { t } = useLang();
  const path = usePathname();
  if (count === 0 || HIDE.some((h) => path.startsWith(h))) return null;
  return (
    <button className="floating-cart" onClick={() => setCartOpen(true)} aria-haspopup="dialog">
      <CartIcon width={18} height={18} /> <b>{count} {count === 1 ? 'item' : 'items'}</b> <span className="fc-sep">|</span> {rupees(subtotalPaise)} <span className="fc-go">{t('view_cart')} ›</span>
    </button>
  );
}
