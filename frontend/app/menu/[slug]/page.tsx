import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ItemPanel from '@/components/ItemPanel';
import MenuCard from '@/components/MenuCard';
import Row from '@/components/Row';
import { api, ItemDetail } from '@/lib/api';
import { loadMenu } from '@/lib/menu-data';
import LocalName from '@/components/LocalName';

export const dynamic = 'force-dynamic';

async function getItem(slug: string): Promise<ItemDetail | null> {
  try {
    return await api<ItemDetail>(`/menu/items/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const item = await getItem((await params).slug);
  return item ? { title: item.names.en, description: item.descriptions.en, openGraph: { images: [item.imageUrl] } } : { title: 'Dish not found' };
}

export default async function ItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const item = await getItem((await params).slug);
  if (!item) notFound();
  const menu = await loadMenu();
  const related = (menu?.find((c) => c.slug === item.category.slug)?.items ?? []).filter((i) => i.id !== item.id);

  // Structured data so search engines can show the dish with its price.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MenuItem',
    name: item.names.en,
    description: item.descriptions.en,
    image: item.imageUrl,
    suitableForDiet: ['https://schema.org/VegetarianDiet', ...(item.isVegan ? ['https://schema.org/VeganDiet'] : [])],
    offers: { '@type': 'Offer', price: (item.pricePaise / 100).toFixed(2), priceCurrency: 'INR', availability: item.isAvailable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="container">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link> <span>/</span> <Link href="/menu">Shop</Link> <span>/</span>{' '}
          <Link href={`/menu?cat=${item.category.slug}`}><LocalName names={item.category.names} /></Link> <span>/</span> <b><LocalName names={item.names} /></b>
        </nav>
      </div>
      <div className="container section-sm"><ItemPanel item={item} /></div>
      {related.length > 0 && (
        <Row title="You may also like" sub="More from this category" href={`/menu?cat=${item.category.slug}`}>
          {related.map((i) => <div className="row-item" key={i.id}><MenuCard item={i} categorySlug={item.category.slug} /></div>)}
        </Row>
      )}
    </>
  );
}
