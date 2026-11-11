// Brand + content configuration. Everything marked TBC is a placeholder until management confirms it.

export const BRAND = {
  name: 'Mylapore Restaurant',
  short: 'MYLAPORE',
  badge: 'Pure Veg',
  tagline: 'The Authentic Taste of South India.',
  address: 'Tiruchanoor Road, Tirupati, Andhra Pradesh, India',
  // TBC: confirm with management before launch
  hours: 'To be announced',
  phone: '', // e.g. '+91 98xxxxxx10' (leave empty to show "To be announced")
  email: '',
  social: {
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM ?? '',
    facebook: process.env.NEXT_PUBLIC_FACEBOOK ?? '',
    youtube: process.env.NEXT_PUBLIC_YOUTUBE ?? '',
    whatsapp: process.env.NEXT_PUBLIC_WHATSAPP ?? '',
  },
};

export const unsplash = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`;

export const IMG = {
  dosa: unsplash('1668236543090-82eba5ee5976'),
  idli: unsplash('1589301760014-d929f3979dbc'),
  idliVada: unsplash('1630383249896-424e482df921'),
  thali: unsplash('1626777552726-4a6b54c97e46'),
  northThali: unsplash('1546833999-b9f581a1996d'),
  paneer: unsplash('1631452180519-c014fe946bc7'),
  tikka: unsplash('1567188040759-fb8a883dc6d8'),
  samosa: unsplash('1601050690597-df0568f70950'),
  pavBhaji: unsplash('1606491956689-2ea866880c84'),
  salad: unsplash('1512621776951-a57141f2eefd'),
  sundae: unsplash('1563805042-7684c019e1cb'),
};

/** Category card imagery, keyed by category slug (images are all verified vegetarian). */
export const CATEGORY_IMAGES: Record<string, string> = {
  'south-indian-breakfast': '/menu/pongal.jpg',
  'idli-dosa': IMG.dosa,
  'traditional-meals': IMG.thali,
  'north-indian': IMG.paneer,
  'chinese-veg': '/menu/veg-hakka-noodles.jpg',
  'snacks-starters': IMG.tikka,
  'fresh-juices': '/menu/sugarcane-juice.jpg',
  'desserts-sweets': '/menu/mysore-pak.jpg',
};

export const SIGNATURE_SLUGS = ['masala-dosa', 'ghee-roast-dosa', 'idli-sambar', 'medu-vada', 'south-indian-meals', 'mini-tiffin', 'pongal', 'poori-masala'];
export const COMBO_SLUGS = ['idli-vada-combo', 'mini-tiffin', 'south-indian-meals', 'north-indian-thali'];
export const CHEFS_SPECIAL_SLUG = 'ghee-roast-dosa';
/** Management sets this daily (later: a backend setting). */
export const TODAYS_SPECIAL_SLUG = 'pongal';

export const GALLERY: { src: string; alt: string }[] = [
  { src: IMG.dosa, alt: 'Masala dosa with chutneys' },
  { src: '/menu/ghee-roast-dosa.jpg', alt: 'Ghee roast dosa' },
  { src: IMG.thali, alt: 'South Indian meals' },
  { src: '/menu/pongal.jpg', alt: 'Pongal with sambar' },
  { src: IMG.idli, alt: 'Idli with coconut chutney' },
  { src: '/menu/medu-vada.jpg', alt: 'Medu vada with sambar' },
  { src: IMG.paneer, alt: 'Paneer butter masala' },
  { src: '/menu/poori-masala.jpg', alt: 'Poori with potato masala' },
  { src: IMG.tikka, alt: 'Paneer tikka' },
  { src: IMG.pavBhaji, alt: 'Pav bhaji' },
  { src: '/menu/mysore-pak.jpg', alt: 'Mysore pak on a banana leaf' },
  { src: '/menu/gulab-jamun.jpg', alt: 'Gulab jamun' },
  { src: '/menu/payasam.jpg', alt: 'Semiya payasam' },
  { src: '/menu/sugarcane-juice.jpg', alt: 'Fresh sugarcane juice' },
  { src: IMG.northThali, alt: 'North Indian thali' },
  { src: IMG.idliVada, alt: 'Idli and vada platter' },
];

/** SAMPLE TEXT ONLY. Replace with real, permissioned guest reviews before launch. */
export const TESTIMONIALS = [
  { quote: 'Sample review: crisp dosas and a sambar that tastes like home.', who: 'Guest name', sample: true },
  { quote: 'Sample review: a calm, welcoming place for the whole family after darshan.', who: 'Guest name', sample: true },
  { quote: 'Sample review: fresh food, quick service, and everything is pure vegetarian.', who: 'Guest name', sample: true },
];

export const COMMITMENTS = [
  { icon: '🌿', title: '100% Pure Vegetarian', text: 'Our kitchen is entirely vegetarian: no meat, fish or egg.' },
  { icon: '🪔', title: 'Authentic South Indian Flavours', text: 'Dosas, idlis, pongal and meals cooked the way they are meant to taste.' },
  { icon: '🥥', title: 'Fresh, Quality Ingredients', text: 'Sourced fresh and prepared to order, never reheated shortcuts.' },
  { icon: '📜', title: 'Traditional Recipes', text: 'Time-honoured methods, from the sambar to the filter of every spice.' },
  { icon: '🙏', title: 'Excellent Hospitality', text: 'Every guest is welcomed like family, whether you dine in, take away or order home.' },
];

/** Home-page collections (category groups chosen by the kitchen). */
export const COLLECTIONS = [
  { title: 'Tiffin Time', cats: ['south-indian-breakfast'] },
  { title: 'Idli & Dosa', cats: ['idli-dosa'] },
  { title: 'Meals & Thali', cats: ['traditional-meals', 'north-indian'] },
  { title: 'Starters & Snacks', cats: ['snacks-starters'] },
  { title: 'Cool Drinks', cats: ['fresh-juices'] },
  { title: 'Sweet Endings', cats: ['desserts-sweets'] },
];
