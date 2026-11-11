import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import { Suspense } from 'react';
import BottomNav from '@/components/BottomNav';
import CartDrawer from '@/components/CartDrawer';
import CategoryBar from '@/components/CategoryBar';
import Footer from '@/components/Footer';
import FloatingCart from '@/components/FloatingCart';
import Header from '@/components/Header';
import ItemSheet from '@/components/ItemSheet';
import LocationModal from '@/components/LocationModal';
import Providers from '@/components/Providers';
import { BRAND } from '@/lib/site';
import './globals.css';
import './app-ui.css';

const display = Fraunces({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-display', display: 'swap' });
const body = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  title: { default: `${BRAND.name} | 100% Pure Vegetarian South Indian, Tirupati`, template: `%s | ${BRAND.name}` },
  description: `${BRAND.tagline} Pure vegetarian South Indian and Indian food on Tiruchanoor Road, Tirupati. Dine in, takeaway and home delivery.`,
  openGraph: { title: BRAND.name, description: BRAND.tagline, type: 'website', locale: 'en_IN' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Restaurant',
  name: BRAND.name,
  servesCuisine: ['South Indian', 'Indian', 'Vegetarian'],
  address: { '@type': 'PostalAddress', streetAddress: 'Tiruchanoor Road', addressLocality: 'Tirupati', addressRegion: 'Andhra Pradesh', addressCountry: 'IN' },
};

// Runs before first paint so the saved/system theme is applied without a flash.
const themeScript = `try{var q=new URLSearchParams(location.search).get('theme');if(q==='light'||q==='dark')localStorage.setItem('theme',q);var t=localStorage.getItem('theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <Providers>
          <a href="#main" className="skip">Skip to content</a>
          <Header />
          <Suspense fallback={null}><CategoryBar /></Suspense>
          <main id="main">{children}</main>
          <Footer />
          <FloatingCart />
          <BottomNav />
          <CartDrawer />
          <ItemSheet />
          <LocationModal />
        </Providers>
      </body>
    </html>
  );
}
