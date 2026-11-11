/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Render <title>/<meta> in the initial <head> for every client (default streams them late, which hides them from SEO tools).
  htmlLimitedBots: /.*/,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' }, // allows Google sign-in popups
        ],
      },
      { source: '/icons/:file*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      { source: '/menu/:file*.jpg', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }] },
    ];
  },
};
export default nextConfig;
