// DEMO DATA ONLY. Dishes, descriptions and prices are placeholders until management confirms them.
// Local images (/menu/*.jpg) are served by the frontend; credits are in frontend/public/menu/credits.json.
const n = (en: string, te: string, ta: string, kn: string, hi: string) => ({ en, te, ta, kn, hi });
const same = (s: string) => n(s, s, s, s, s); // English description used until translations are supplied

export const categories = [
  { slug: 'south-indian-breakfast', sortOrder: 1, names: n('South Indian Breakfast', 'దక్షిణ భారత అల్పాహారం', 'தென்னிந்திய காலை உணவு', 'ದಕ್ಷಿಣ ಭಾರತೀಯ ಉಪಾಹಾರ', 'दक्षिण भारतीय नाश्ता') },
  { slug: 'idli-dosa', sortOrder: 2, names: n('Idli & Dosa', 'ఇడ్లీ & దోశ', 'இட்லி & தோசை', 'ಇಡ್ಲಿ & ದೋಸೆ', 'इडली और डोसा') },
  { slug: 'traditional-meals', sortOrder: 3, names: n('Traditional Meals', 'సంప్రదాయ భోజనం', 'பாரம்பரிய சாப்பாடு', 'ಸಾಂಪ್ರದಾಯಿಕ ಊಟ', 'पारंपरिक भोजन') },
  { slug: 'north-indian', sortOrder: 4, names: n('North Indian Cuisine', 'ఉత్తర భారత వంటకాలు', 'வட இந்திய உணவுகள்', 'ಉತ್ತರ ಭಾರತೀಯ ಖಾದ್ಯ', 'उत्तर भारतीय व्यंजन') },
  { slug: 'chinese-veg', sortOrder: 5, names: n('Chinese Vegetarian', 'చైనీస్ శాకాహారం', 'சீன சைவ உணவு', 'ಚೈನೀಸ್ ಸಸ್ಯಾಹಾರ', 'चाइनीज़ शाकाहारी') },
  { slug: 'snacks-starters', sortOrder: 6, names: n('Snacks & Starters', 'స్నాక్స్ & స్టార్టర్లు', 'சிற்றுண்டி & ஸ்டார்ட்டர்', 'ತಿಂಡಿ & ಸ್ಟಾರ್ಟರ್', 'स्नैक्स और स्टार्टर') },
  { slug: 'fresh-juices', sortOrder: 7, names: n('Fresh Juices', 'తాజా జ్యూస్‌లు', 'புதிய ஜூஸ்கள்', 'ತಾಜಾ ಜ್ಯೂಸ್', 'ताज़ा जूस') },
  { slug: 'desserts-sweets', sortOrder: 8, names: n('Desserts & Sweets', 'డెజర్ట్స్ & స్వీట్లు', 'இனிப்புகள்', 'ಸಿಹಿ ತಿನಿಸು', 'मिठाई और डेसर्ट') },
];

/** Existing items: new category (and a few renames). Applied on top of the base seed. */
export const moves: Record<string, string> = {
  'masala-dosa': 'idli-dosa',
  'idli-sambar': 'idli-dosa',
  'idli-vada-combo': 'south-indian-breakfast',
  'veg-samosa': 'snacks-starters',
  'paneer-tikka': 'snacks-starters',
  'pav-bhaji': 'snacks-starters',
  'garden-salad': 'snacks-starters',
  'paneer-butter-masala': 'north-indian',
  'north-indian-thali': 'north-indian',
  'south-indian-meals': 'traditional-meals',
  'chocolate-sundae': 'desserts-sweets',
};

export const renames: Record<string, { names: Record<string, string>; descriptions: Record<string, string> }> = {
  'idli-sambar': {
    names: n('Crispy Idli', 'క్రిస్పీ ఇడ్లీ', 'க்ரிஸ்பி இட்லி', 'ಕ್ರಿಸ್ಪಿ ಇಡ್ಲಿ', 'क्रिस्पी इडली'),
    descriptions: same('Soft idlis with golden edges, served with sambar and coconut chutney.'),
  },
};

export const removedSlugs = ['veg-curry-rice']; // image could not be verified as vegetarian

export const extraItems = [
  { slug: 'ghee-roast-dosa', cat: 'idli-dosa', price: 11000, photo: '/menu/ghee-roast-dosa.jpg', best: true,
    names: n('Ghee Roast Dosa', 'నెయ్యి రోస్ట్ దోశ', 'நெய் ரோஸ்ட் தோசை', 'ತುಪ್ಪ ರೋಸ್ಟ್ ದೋಸೆ', 'घी रोस्ट डोसा'),
    desc: same('Paper-thin, golden dosa roasted in pure ghee, served with chutneys and sambar.') },
  { slug: 'pongal', cat: 'south-indian-breakfast', price: 7000, photo: '/menu/pongal.jpg', best: true,
    names: n('Pongal', 'పొంగల్', 'பொங்கல்', 'ಪೊಂಗಲ್', 'पोंगल'),
    desc: same('Comforting rice and moong dal tempered with pepper, cumin, cashew and ghee, with sambar.') },
  { slug: 'medu-vada', cat: 'south-indian-breakfast', price: 5000, photo: '/menu/medu-vada.jpg', best: true,
    names: n('Medu Vada', 'మెదు వడ', 'மெது வடை', 'ಮೆದು ವಡೆ', 'मेदू वड़ा'),
    desc: same('Crisp outside, fluffy inside urad dal vadas with sambar and chutney.') },
  { slug: 'mini-tiffin', cat: 'south-indian-breakfast', price: 12000, photo: '1630383249896-424e482df921',
    names: n('Mini Tiffin', 'మినీ టిఫిన్', 'மினி டிபன்', 'ಮಿನಿ ಟಿಫನ್', 'मिनी टिफिन'),
    desc: same('A tasting plate of idli, vada and the day\'s tiffin specials with sambar and chutneys.') },
  { slug: 'poori-masala', cat: 'south-indian-breakfast', price: 11000, photo: '/menu/poori-masala.jpg', best: true,
    names: n('Poori Masala', 'పూరీ మసాలా', 'பூரி மசாலா', 'ಪೂರಿ ಮಸಾಲಾ', 'पूरी मसाला'),
    desc: same('Puffed golden pooris with a warm, lightly spiced potato masala.') },
  { slug: 'veg-hakka-noodles', cat: 'chinese-veg', price: 14000, photo: '/menu/veg-hakka-noodles.jpg', spicy: true,
    names: n('Veg Hakka Noodles', 'వెజ్ హక్కా నూడిల్స్', 'வெஜ் ஹக்கா நூடுல்ஸ்', 'ವೆಜ್ ಹಕ್ಕಾ ನೂಡಲ್ಸ್', 'वेज हक्का नूडल्स'),
    desc: same('Wok-tossed noodles with crunchy vegetables and a light soy-garlic finish. Egg-free.') },
  { slug: 'sugarcane-juice', cat: 'fresh-juices', price: 6000, photo: '/menu/sugarcane-juice.jpg',
    names: n('Sugarcane Juice', 'చెరకు రసం', 'கரும்பு சாறு', 'ಕಬ್ಬಿನ ಹಾಲು', 'गन्ने का रस'),
    desc: same('Freshly pressed sugarcane juice with a hint of ginger and lemon.') },
  { slug: 'mosambi-juice', cat: 'fresh-juices', price: 7000, photo: '/menu/mosambi-juice.jpg',
    names: n('Fresh Mosambi Juice', 'బత్తాయి రసం', 'சாத்துக்குடி சாறு', 'ಮೋಸಂಬಿ ರಸ', 'मौसंबी जूस'),
    desc: same('Sweet-lime juice, squeezed to order.') },
  { slug: 'gulab-jamun', cat: 'desserts-sweets', price: 8000, photo: '/menu/gulab-jamun.jpg',
    names: n('Gulab Jamun', 'గులాబ్ జామూన్', 'குலாப் ஜாமூன்', 'ಗುಲಾಬ್ ಜಾಮೂನ್', 'गुलाब जामुन'),
    desc: same('Soft milk-solid dumplings soaked in cardamom-rose syrup.') },
  { slug: 'mysore-pak', cat: 'desserts-sweets', price: 7000, photo: '/menu/mysore-pak.jpg', best: true,
    names: n('Mysore Pak', 'మైసూర్ పాక్', 'மைசூர் பாக்', 'ಮೈಸೂರು ಪಾಕ್', 'मैसूर पाक'),
    desc: same('Melt-in-the-mouth gram flour and ghee sweet, a South Indian classic.') },
  { slug: 'payasam', cat: 'desserts-sweets', price: 9000, photo: '/menu/payasam.jpg',
    names: n('Semiya Payasam', 'సేమియా పాయసం', 'சேமியா பாயசம்', 'ಶ್ಯಾವಿಗೆ ಪಾಯಸ', 'सेवइयां पायसम'),
    desc: same('Vermicelli simmered in sweetened milk with cardamom, cashew and raisins.') },
];

/**
 * DRAFT item details (ingredients, allergens, dietary, spice). These are reasonable starting points only:
 * the kitchen MUST confirm every row before launch. Nutrition is intentionally not seeded (no real values yet).
 * tags: south-indian-rice = South Indian, goes with rice | north-indian-roti = North Indian, goes with roti | idli-dosa = goes with idli & dosa
 */
type Detail = { cuisine: string; tags?: string[]; vegan?: boolean; jain?: boolean; spice?: 'Mild' | 'Medium' | 'Spicy'; ing: string; allergens?: string[] };
export const details: Record<string, Detail> = {
  'masala-dosa': { cuisine: 'SOUTH_INDIAN', tags: ['idli-dosa'], vegan: true, spice: 'Mild', ing: 'Rice, urad dal, potato, onion, mustard seeds, curry leaves, turmeric, oil; served with sambar and chutneys' },
  'ghee-roast-dosa': { cuisine: 'SOUTH_INDIAN', tags: ['idli-dosa'], spice: 'Mild', ing: 'Rice, urad dal, fenugreek, ghee; served with sambar and chutneys', allergens: ['Milk'] },
  'idli-sambar': { cuisine: 'SOUTH_INDIAN', tags: ['idli-dosa'], vegan: true, spice: 'Mild', ing: 'Rice, urad dal; sambar (toor dal, vegetables, tamarind, spices) and coconut chutney' },
  'idli-vada-combo': { cuisine: 'SOUTH_INDIAN', tags: ['idli-dosa'], vegan: true, spice: 'Mild', ing: 'Rice, urad dal, black pepper, curry leaves; sambar and chutneys' },
  'mini-tiffin': { cuisine: 'SOUTH_INDIAN', tags: ['idli-dosa'], spice: 'Mild', ing: 'Idli, vada and tiffin specials of the day; sambar and chutneys' },
  'medu-vada': { cuisine: 'SOUTH_INDIAN', tags: ['idli-dosa'], vegan: true, spice: 'Mild', ing: 'Urad dal, black pepper, green chilli, curry leaves, ginger, oil; sambar and chutney' },
  'pongal': { cuisine: 'SOUTH_INDIAN', tags: ['south-indian-rice'], spice: 'Mild', ing: 'Rice, moong dal, ghee, black pepper, cumin, ginger, cashew, curry leaves', allergens: ['Milk', 'Tree nuts'] },
  'poori-masala': { cuisine: 'SOUTH_INDIAN', tags: ['north-indian-roti'], spice: 'Medium', ing: 'Wheat flour poori; potato masala with onion, turmeric, mustard seeds and green chilli', allergens: ['Wheat'] },
  'south-indian-meals': { cuisine: 'SOUTH_INDIAN', tags: ['south-indian-rice'], spice: 'Medium', ing: 'Rice, sambar, rasam, seasonal vegetable curries, curd, papad, pickle', allergens: ['Milk'] },
  'veg-samosa': { cuisine: 'NORTH_INDIAN', spice: 'Medium', ing: 'Wheat flour pastry; potato, green peas, cumin, coriander, spices', allergens: ['Wheat'] },
  'paneer-tikka': { cuisine: 'NORTH_INDIAN', spice: 'Spicy', ing: 'Paneer, curd marinade, bell pepper, onion, spices', allergens: ['Milk'] },
  'pav-bhaji': { cuisine: 'NORTH_INDIAN', spice: 'Spicy', ing: 'Mixed vegetables, butter, tomato, pav bhaji masala; soft bread buns', allergens: ['Milk', 'Wheat'] },
  'garden-salad': { cuisine: 'OTHER', vegan: true, jain: true, spice: 'Mild', ing: 'Seasonal raw vegetables, chickpeas, greens, lemon' },
  'paneer-butter-masala': { cuisine: 'NORTH_INDIAN', tags: ['north-indian-roti'], spice: 'Mild', ing: 'Paneer, tomato, butter, cream, cashew, spices', allergens: ['Milk', 'Tree nuts'] },
  'north-indian-thali': { cuisine: 'NORTH_INDIAN', tags: ['north-indian-roti'], spice: 'Medium', ing: 'Rotis, dal, seasonal sabzi, rice, curd, pickle', allergens: ['Milk', 'Wheat'] },
  'veg-hakka-noodles': { cuisine: 'CHINESE', spice: 'Medium', ing: 'Noodles, cabbage, carrot, capsicum, spring onion, soy sauce, garlic. Egg-free', allergens: ['Wheat', 'Soy'] },
  'sugarcane-juice': { cuisine: 'OTHER', vegan: true, jain: true, spice: 'Mild', ing: 'Freshly pressed sugarcane, ginger, lemon' },
  'mosambi-juice': { cuisine: 'OTHER', vegan: true, jain: true, spice: 'Mild', ing: 'Fresh sweet lime (mosambi)' },
  'gulab-jamun': { cuisine: 'NORTH_INDIAN', spice: 'Mild', ing: 'Milk solids, flour, sugar syrup, cardamom, rose water', allergens: ['Milk', 'Wheat'] },
  'mysore-pak': { cuisine: 'SOUTH_INDIAN', spice: 'Mild', ing: 'Gram flour, ghee, sugar', allergens: ['Milk'] },
  'payasam': { cuisine: 'SOUTH_INDIAN', spice: 'Mild', ing: 'Vermicelli, milk, sugar, cardamom, cashew, raisins', allergens: ['Milk', 'Wheat', 'Tree nuts'] },
  'chocolate-sundae': { cuisine: 'OTHER', spice: 'Mild', ing: 'Vanilla and chocolate ice cream, chocolate sauce', allergens: ['Milk'] },
};
