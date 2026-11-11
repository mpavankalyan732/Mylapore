'use client';
import Link from 'next/link';
import { ArrowRight } from './Icons';
import { useAuth, useLang } from './Providers';

export default function CtaBand() {
  const { user } = useAuth();
  const { t } = useLang();
  return (
    <section className="container">
      <div className="cta-band">
        <h2>{t('hungry')}</h2>
        <p>{user ? t('hungry_sub') : t('hungry_sub')}</p>
        <Link href={user ? '/menu' : '/signup'} className="btn btn-light btn-lg">{user ? t('browse_the_menu') : t('create_account')} <ArrowRight width={16} height={16} /></Link>
      </div>
    </section>
  );
}
