import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import Reveal from '@/components/Reveal';
import SectionTitle from '@/components/SectionTitle';
import { BRAND, COMMITMENTS, IMG } from '@/lib/site';

export const metadata: Metadata = { title: 'About Us', description: `About ${BRAND.name}: 100% pure vegetarian, authentic South Indian flavours in Tirupati.` };

export default function About() {
  return (
    <>
      <div className="page-hero"><div className="container"><SectionTitle as="h1" light eyebrow="Our story" title="About Mylapore" sub={BRAND.tagline} /></div></div>

      <section className="container section about-grid">
        <Reveal className="about-photo"><div className="photo-frame"><Image src={IMG.idli} alt="Idli with coconut chutney on a banana leaf" fill sizes="(max-width: 900px) 100vw, 520px" priority /></div></Reveal>
        <Reveal delay={120}>
          <h2>A pure vegetarian table, set the South Indian way</h2>
          <p>
            {BRAND.name} on Tiruchanoor Road, Tirupati serves authentic South Indian and Indian vegetarian food to pilgrims, families, groups and neighbours alike.
            From crisp dosas and soft idlis to full traditional meals, everything is cooked fresh, from traditional recipes, in a kitchen that is 100% vegetarian.
          </p>
          <p>Dine in with your family, take your food with you, or have it delivered. Large group and catering requests are welcome; speak to our team.</p>
          <div className="hero-cta">
            <Link href="/menu" className="btn btn-maroon">Explore Menu</Link>
            <Link href="/reservations" className="btn btn-outline">Reserve a table</Link>
          </div>
        </Reveal>
      </section>

      <section className="band band-cream">
        <div className="container section">
          <Reveal><SectionTitle eyebrow="What we stand for" title="Our commitments" /></Reveal>
          <div className="commit-cards">
            {COMMITMENTS.map((c, i) => (
              <Reveal key={c.title} delay={i * 70}>
                <div className="commit-card"><span className="commit-icon" aria-hidden="true">{c.icon}</span><h3>{c.title}</h3><p>{c.text}</p></div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
