import type { Metadata } from 'next';
import Link from 'next/link';
import Reveal from '@/components/Reveal';
import SectionTitle from '@/components/SectionTitle';
import T from '@/components/Translated';
import { BRAND } from '@/lib/site';

export const metadata: Metadata = { title: 'Contact', description: `Find ${BRAND.name} on Tiruchanoor Road, Tirupati. Reserve a table or order online.` };

export default function Contact() {
  const map = `https://www.google.com/maps?q=${encodeURIComponent('Tiruchanoor Road, Tirupati, Andhra Pradesh')}&output=embed`;
  return (
    <>
      <div className="page-hero"><div className="container"><SectionTitle as="h1" light eyebrow="Visit or call" title={<T k="contact_title" />} sub={BRAND.tagline} /></div></div>
      <section className="container section contact-grid">
        <Reveal>
          <div className="panel info-panel">
            <h2>Find us</h2>
            <p>📍 <strong>Address</strong><br />{BRAND.address}</p>
            <p>🕒 <strong>Opening hours</strong><br />{BRAND.hours}</p>
            <p>📞 <strong>Phone</strong><br />{BRAND.phone || 'To be announced'}</p>
            {BRAND.email && <p>✉️ <strong>Email</strong><br />{BRAND.email}</p>}
            <div className="hero-cta">
              <Link href="/menu" className="btn btn-maroon"><T k="order_now" /></Link>
              <Link href="/reservations" className="btn btn-outline"><T k="reserve_table" /></Link>
            </div>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <iframe title="Map to Mylapore Restaurant, Tiruchanoor Road, Tirupati" src={map} className="map" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </Reveal>
      </section>
    </>
  );
}
