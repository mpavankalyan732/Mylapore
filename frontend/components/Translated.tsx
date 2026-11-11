'use client';
import { Key } from '@/lib/i18n';
import { useLang } from './Providers';

/** Tiny client wrapper so server components can render translated text. */
export default function T({ k }: { k: Key }) {
  const { t } = useLang();
  return <>{t(k)}</>;
}
