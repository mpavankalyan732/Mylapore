import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mylapore Restaurant',
    short_name: 'Mylapore',
    description: '100% pure vegetarian South Indian food in Tirupati. Dine in, takeaway and delivery.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fbf6ee',
    theme_color: '#b83a1c',
    categories: ['food', 'restaurants'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
