/**
 * Builds static, pre-optimised dish photos so the site never resizes images on demand
 * (on-demand resizing on a sleeping free Render instance was the cause of the slow images).
 *
 *   node scripts/make-dish-images.mjs [apiBase]      default: https://mylapore-api.onrender.com/api/v1
 *
 * Reads the live menu, downloads each dish's current photo (the restaurant's own photos, nothing replaced),
 * and writes   public/dishes/<slug>-480.webp   (cards, rows, thumbnails)
 *              public/dishes/<slug>-960.webp   (detail views, lightbox)
 * plus         lib/dish-images.json            (which slugs exist + a tiny blur placeholder for each).
 * Re-run it whenever a dish or its photo changes. Original aspect ratio is kept (4:3 crop for consistency).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const API = (process.argv[2] ?? 'https://mylapore-api.onrender.com/api/v1').replace(/\/$/, '');
const SITE = process.env.SITE_URL ?? 'https://mylapore-web.onrender.com';
const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'public', 'dishes');
fs.mkdirSync(outDir, { recursive: true });

const menu = await (await fetch(`${API}/menu`)).json();
const cats = Array.isArray(menu) ? menu : menu.categories;
const items = cats.flatMap((c) => c.items);

const manifest = {};
for (const item of items) {
  const src = item.imageUrl.startsWith('/') ? `${SITE}${item.imageUrl}` : item.imageUrl.replace(/w=\d+/, 'w=1200');
  try {
    const res = await fetch(src, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    for (const [w, q] of [[480, 72], [960, 76]]) {
      await sharp(buf).rotate().resize({ width: w, height: Math.round((w * 3) / 4), fit: 'cover' }).webp({ quality: q, effort: 5 })
        .toFile(path.join(outDir, `${item.slug}-${w}.webp`));
    }
    const blur = await sharp(buf).resize(16, 12, { fit: 'cover' }).blur(1).webp({ quality: 40 }).toBuffer();
    manifest[item.slug] = { blur: `data:image/webp;base64,${blur.toString('base64')}` };
    console.log('ok  ', item.slug);
  } catch (e) {
    console.warn('SKIP', item.slug, e.message);
  }
}
fs.writeFileSync(path.join(root, 'lib', 'dish-images.json'), JSON.stringify(manifest));
const bytes = fs.readdirSync(outDir).reduce((n, f) => n + fs.statSync(path.join(outDir, f)).size, 0);
console.log(`${Object.keys(manifest).length}/${items.length} dishes, ${(bytes / 1024).toFixed(0)} KB total`);
