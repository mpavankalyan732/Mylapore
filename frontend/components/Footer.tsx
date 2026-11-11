import Link from 'next/link';
import { BRAND } from '@/lib/site';
import Logo from './Logo';
import T from './Translated';

const COLS: { title: "shop" | "support" | "company"; links: [string, string][] }[] = [
  { title: 'shop' as const, links: [['Shop All', '/menu'], ['All Categories', '/menu'], ['Specialities', '/specialities'], ['Track Order', '/orders'], ['My Orders', '/orders']] },
  { title: 'support' as const, links: [['Welcome Back', '/signin'], ['Contact Us', '/contact'], ['Reserve a Table', '/reservations']] },
  { title: 'company' as const, links: [['About Us', '/about'], ['Gallery', '/gallery'], ['Photo Credits', '/credits']] },
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="gopuram" aria-hidden="true" />
      <div className="container footer-grid">
        <div className="footer-brand">
          <Logo />
          <p>{BRAND.tagline} Pure vegetarian, cooked fresh on Tiruchanoor Road, Tirupati.</p>
          <p className="foot-line">📍 {BRAND.address}</p>
          <p className="foot-line">🕒 Opening hours: {BRAND.hours}</p>
          <p className="foot-line">📞 {BRAND.phone || 'Phone: to be announced'}</p>
        </div>
        {COLS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="foot-title"><T k={c.title} /></h2>
            <ul>{c.links.map(([label, href]) => <li key={label}><Link href={href}>{label}</Link></li>)}</ul>
          </nav>
        ))}
      </div>
      <div className="container footer-base"><span>© {new Date().getFullYear()} {BRAND.name}. 100% Pure Vegetarian.</span></div>
    </footer>
  );
}
