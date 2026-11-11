'use client';
import type { Names } from '@/lib/api';
import { useLang } from './Providers';

/** Renders a backend-supplied multilingual name in the visitor's language. */
export default function LocalName({ names }: { names: Names }) {
  const { pick } = useLang();
  return <>{pick(names)}</>;
}
