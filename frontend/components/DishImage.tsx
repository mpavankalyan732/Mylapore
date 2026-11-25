'use client';
import Image, { ImageLoaderProps } from 'next/image';
import { useState } from 'react';
import manifest from '@/lib/dish-images.json';

const known = manifest as Record<string, { blur: string }>;

/**
 * A dish photo served from pre-optimised static WebP files (public/dishes, built by scripts/make-dish-images.mjs):
 * 480px for cards and thumbnails, 960px for detail views. No on-demand resizing, so nothing waits on a sleeping server.
 * Static files are cached for a year (see next.config.mjs). A tiny blur placeholder shows while the photo loads.
 * If a dish has no static file yet (or one fails to load) it falls back to the dish's original image URL.
 */
export default function DishImage({
  item, alt, fill, sizes, priority, width, height, className,
}: {
  item: { slug: string; imageUrl: string };
  alt: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
  width?: number;
  height?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const entry = known[item.slug];

  if (!entry || failed) {
    // Original URL, through the normal optimiser. Only used until the static file exists.
    return <Image src={item.imageUrl} alt={alt} fill={fill} sizes={sizes} priority={priority} width={fill ? undefined : width} height={fill ? undefined : height} className={className} />;
  }

  const loader = ({ width: w }: ImageLoaderProps) => `/dishes/${item.slug}-${w <= 480 ? 480 : 960}.webp`;
  return (
    <Image
      loader={loader}
      src={item.slug}
      alt={alt}
      fill={fill}
      sizes={sizes}
      priority={priority}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      className={className}
      placeholder="blur"
      blurDataURL={entry.blur}
      onError={() => setFailed(true)}
    />
  );
}
