import { PrismaClient } from '@prisma/client';
import { categories, details, extraItems, moves, removedSlugs, renames } from './seed-extra';

const prisma = new PrismaClient();
const img = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=75`;

// DEMO DATA ONLY. Menu items and prices are placeholders until management confirms them.


const items = [
  { slug: 'masala-dosa', cat: 'south-indian', price: 9000, photo: '1668236543090-82eba5ee5976', best: true,
    names: { en: 'Masala Dosa', te: 'మసాలా దోశ', ta: 'மசாலா தோசை', kn: 'ಮಸಾಲಾ ದೋಸೆ', hi: 'मसाला डोसा' },
    desc: { en: 'Crisp rice-lentil crepe with spiced potato filling, sambar and chutneys.', te: 'మసాలా బంగాళదుంప కూరతో కరకరలాడే దోశ, సాంబార్, చట్నీలతో.', ta: 'மசாலா உருளைக்கிழங்கு நிரப்பிய மொறுமொறு தோசை, சாம்பார், சட்னியுடன்.', kn: 'ಮಸಾಲಾ ಆಲೂಗಡ್ಡೆ ಪಲ್ಯದೊಂದಿಗೆ ಗರಿಗರಿ ದೋಸೆ, ಸಾಂಬಾರ್, ಚಟ್ನಿ.', hi: 'मसालेदार आलू भरावन, सांभर और चटनी के साथ कुरकुरा डोसा।' } },
  { slug: 'idli-sambar', cat: 'south-indian', price: 6000, photo: '1589301760014-d929f3979dbc', best: true,
    names: { en: 'Idli with Sambar', te: 'ఇడ్లీ సాంబార్', ta: 'இட்லி சாம்பார்', kn: 'ಇಡ್ಲಿ ಸಾಂಬಾರ್', hi: 'इडली सांभर' },
    desc: { en: 'Steamed rice cakes served with sambar and coconut chutney.', te: 'సాంబార్, కొబ్బరి చట్నీతో ఆవిరిపై ఉడికిన ఇడ్లీ.', ta: 'சாம்பார், தேங்காய் சட்னியுடன் ஆவியில் வேகவைத்த இட்லி.', kn: 'ಸಾಂಬಾರ್ ಮತ್ತು ತೆಂಗಿನ ಚಟ್ನಿಯೊಂದಿಗೆ ಬೇಯಿಸಿದ ಇಡ್ಲಿ.', hi: 'सांभर और नारियल चटनी के साथ भाप में पकी इडली।' } },
  { slug: 'idli-vada-combo', cat: 'south-indian', price: 8000, photo: '1630383249896-424e482df921',
    names: { en: 'Idli Vada Combo', te: 'ఇడ్లీ వడ కాంబో', ta: 'இட்லி வடை காம்போ', kn: 'ಇಡ್ಲಿ ವಡೆ ಕಾಂಬೊ', hi: 'इडली वड़ा कॉम्बो' },
    desc: { en: 'Idli and crispy medu vada with sambar and chutneys.', te: 'సాంబార్, చట్నీలతో ఇడ్లీ, మెదు వడ.', ta: 'சாம்பார், சட்னியுடன் இட்லி மற்றும் மெது வடை.', kn: 'ಸಾಂಬಾರ್, ಚಟ್ನಿಯೊಂದಿಗೆ ಇಡ್ಲಿ ಮತ್ತು ಮೆದು ವಡೆ.', hi: 'सांभर और चटनी के साथ इडली और कुरकुरा मेदू वड़ा।' } },
  { slug: 'veg-samosa', cat: 'starters', price: 4000, photo: '1601050690597-df0568f70950',
    names: { en: 'Veg Samosa', te: 'వెజ్ సమోసా', ta: 'வெஜ் சமோசா', kn: 'ವೆಜ್ ಸಮೋಸಾ', hi: 'वेज समोसा' },
    desc: { en: 'Golden pastry filled with spiced potato and peas.', te: 'మసాలా బంగాళదుంప, బఠాణీలతో నింపిన బంగారు రంగు సమోసా.', ta: 'மசாலா உருளைக்கிழங்கு, பட்டாணி நிரப்பிய பொன்னிற சமோசா.', kn: 'ಮಸಾಲಾ ಆಲೂಗಡ್ಡೆ ಮತ್ತು ಬಟಾಣಿ ತುಂಬಿದ ಗೋಲ್ಡನ್ ಸಮೋಸಾ.', hi: 'मसालेदार आलू-मटर भरा सुनहरा समोसा।' } },
  { slug: 'paneer-tikka', cat: 'starters', price: 22000, photo: '1567188040759-fb8a883dc6d8', best: true, spicy: true,
    names: { en: 'Paneer Tikka', te: 'పనీర్ టిక్కా', ta: 'பன்னீர் டிக்கா', kn: 'ಪನೀರ್ ಟಿಕ್ಕಾ', hi: 'पनीर टिक्का' },
    desc: { en: 'Marinated cottage cheese grilled with peppers and onion.', te: 'మిరపకాయలు, ఉల్లితో గ్రిల్ చేసిన మారినేటెడ్ పనీర్.', ta: 'குடைமிளகாய், வெங்காயத்துடன் கிரில் செய்த பன்னீர்.', kn: 'ದೊಣ್ಣೆ ಮೆಣಸು, ಈರುಳ್ಳಿಯೊಂದಿಗೆ ಗ್ರಿಲ್ ಮಾಡಿದ ಪನೀರ್.', hi: 'शिमला मिर्च और प्याज के साथ ग्रिल किया मैरिनेट पनीर।' } },
  { slug: 'pav-bhaji', cat: 'starters', price: 14000, photo: '1606491956689-2ea866880c84', spicy: true,
    names: { en: 'Pav Bhaji', te: 'పావ్ భాజీ', ta: 'பாவ் பாஜி', kn: 'ಪಾವ್ ಭಾಜಿ', hi: 'पाव भाजी' },
    desc: { en: 'Buttery mashed vegetable curry with soft toasted buns.', te: 'వెన్నతో చేసిన కూరగాయల భాజీ, మెత్తని పావ్‌తో.', ta: 'வெண்ணெயில் சமைத்த காய்கறி பாஜி, மென்மையான பாவுடன்.', kn: 'ಬೆಣ್ಣೆಯಲ್ಲಿ ಮಾಡಿದ ತರಕಾರಿ ಭಾಜಿ, ಮೃದು ಪಾವ್‌ನೊಂದಿಗೆ.', hi: 'मक्खन में बनी सब्जी भाजी, नरम पाव के साथ।' } },
  { slug: 'paneer-butter-masala', cat: 'main-course', price: 24000, photo: '1631452180519-c014fe946bc7', best: true,
    names: { en: 'Paneer Butter Masala', te: 'పనీర్ బటర్ మసాలా', ta: 'பன்னீர் பட்டர் மசாலா', kn: 'ಪನೀರ್ ಬಟರ್ ಮಸಾಲಾ', hi: 'पनीर बटर मसाला' },
    desc: { en: 'Soft paneer in a rich, mildly spiced tomato-butter gravy.', te: 'టమాటా-వెన్న గ్రేవీలో మెత్తని పనీర్.', ta: 'தக்காளி-வெண்ணெய் கிரேவியில் மென்மையான பன்னீர்.', kn: 'ಟೊಮೇಟೊ-ಬೆಣ್ಣೆ ಗ್ರೇವಿಯಲ್ಲಿ ಮೃದುವಾದ ಪನೀರ್.', hi: 'टमाटर-मक्खन ग्रेवी में नरम पनीर।' } },
  { slug: 'veg-curry-rice', cat: 'main-course', price: 18000, photo: '1585937421612-70a008356fbe', isJain: true,
    names: { en: 'Mixed Veg Curry with Rice', te: 'మిక్స్డ్ వెజ్ కర్రీ రైస్', ta: 'கலவை காய்கறி குழம்பு சாதம்', kn: 'ಮಿಶ್ರ ತರಕಾರಿ ಕರಿ ಅನ್ನ', hi: 'मिक्स वेज करी चावल' },
    desc: { en: 'Seasonal vegetables in a homestyle gravy with steamed rice.', te: 'ఇంటి శైలి గ్రేవీలో కాలానుగుణ కూరగాయలు, అన్నంతో.', ta: 'வீட்டு முறை கிரேவியில் பருவகால காய்கறிகள், சாதத்துடன்.', kn: 'ಮನೆಶೈಲಿಯ ಗ್ರೇವಿಯಲ್ಲಿ ಋತುಮಾನದ ತರಕಾರಿ, ಅನ್ನದೊಂದಿಗೆ.', hi: 'घर जैसी ग्रेवी में मौसमी सब्जियां, चावल के साथ।' } },
  { slug: 'south-indian-meals', cat: 'thali', price: 20000, photo: '1626777552726-4a6b54c97e46', best: true,
    names: { en: 'South Indian Meals', te: 'దక్షిణ భారత భోజనం', ta: 'தென்னிந்திய சாப்பாடு', kn: 'ದಕ್ಷಿಣ ಭಾರತೀಯ ಊಟ', hi: 'दक्षिण भारतीय भोजन' },
    desc: { en: 'Rice, sambar, rasam, curries, curd, papad and pickle.', te: 'అన్నం, సాంబార్, రసం, కూరలు, పెరుగు, అప్పడం, పచ్చడి.', ta: 'சாதம், சாம்பார், ரசம், கூட்டு, தயிர், அப்பளம், ஊறுகாய்.', kn: 'ಅನ್ನ, ಸಾಂಬಾರ್, ರಸಂ, ಪಲ್ಯ, ಮೊಸರು, ಹಪ್ಪಳ, ಉಪ್ಪಿನಕಾಯಿ.', hi: 'चावल, सांभर, रसम, सब्जियां, दही, पापड़ और अचार।' } },
  { slug: 'north-indian-thali', cat: 'thali', price: 26000, photo: '1546833999-b9f581a1996d',
    names: { en: 'North Indian Thali', te: 'ఉత్తర భారత థాలీ', ta: 'வட இந்திய தாலி', kn: 'ಉತ್ತರ ಭಾರತೀಯ ಥಾಲಿ', hi: 'उत्तर भारतीय थाली' },
    desc: { en: 'Rotis, dal, seasonal sabzi and condiments on a steel thali.', te: 'రోటీలు, పప్పు, కాలానుగుణ కూర, పచ్చళ్ళతో స్టీల్ థాలీ.', ta: 'ரொட்டி, பருப்பு, காய்கறி, ஊறுகாயுடன் தாலி.', kn: 'ರೊಟ್ಟಿ, ದಾಲ್, ತರಕಾರಿ ಪಲ್ಯ, ಉಪ್ಪಿನಕಾಯಿ ಇರುವ ಥಾಲಿ.', hi: 'रोटी, दाल, मौसमी सब्जी और चटनी के साथ स्टील की थाली।' } },
  { slug: 'garden-salad', cat: 'starters', price: 12000, photo: '1512621776951-a57141f2eefd', isJain: true,
    names: { en: 'Garden Fresh Salad', te: 'గార్డెన్ ఫ్రెష్ సలాడ్', ta: 'கார்டன் ஃப்ரெஷ் சாலட்', kn: 'ಗಾರ್ಡನ್ ಫ್ರೆಶ್ ಸಲಾಡ್', hi: 'गार्डन फ्रेश सलाद' },
    desc: { en: 'Fresh seasonal vegetables, chickpeas and greens.', te: 'తాజా కూరగాయలు, శనగలు, ఆకుకూరలు.', ta: 'புதிய காய்கறிகள், கொண்டைக்கடலை, கீரை.', kn: 'ತಾಜಾ ತರಕಾರಿ, ಕಡಲೆ, ಸೊಪ್ಪು.', hi: 'ताजी मौसमी सब्जियां, चना और हरी पत्तियां।' } },
  { slug: 'chocolate-sundae', cat: 'desserts', price: 15000, photo: '1563805042-7684c019e1cb',
    names: { en: 'Chocolate Sundae', te: 'చాక్లెట్ సండే', ta: 'சாக்லேட் சண்டே', kn: 'ಚಾಕೊಲೇಟ್ ಸಂಡೇ', hi: 'चॉकलेट संडे' },
    desc: { en: 'Creamy vanilla and chocolate ice cream with chocolate sauce.', te: 'చాక్లెట్ సాస్‌తో క్రీమీ వెనిలా, చాక్లెట్ ఐస్‌క్రీమ్.', ta: 'சாக்லேட் சாஸுடன் கிரீமி வெனிலா, சாக்லேட் ஐஸ்கிரீம்.', kn: 'ಚಾಕೊಲೇಟ್ ಸಾಸ್‌ನೊಂದಿಗೆ ವೆನಿಲ್ಲಾ, ಚಾಕೊಲೇಟ್ ಐಸ್‌ಕ್ರೀಮ್.', hi: 'चॉकलेट सॉस के साथ क्रीमी वनीला और चॉकलेट आइसक्रीम।' } },
];

async function main() {
  const catIds: Record<string, string> = {};
  for (const c of categories) {
    const row = await prisma.category.upsert({ where: { slug: c.slug }, update: { names: c.names, sortOrder: c.sortOrder }, create: c });
    catIds[c.slug] = row.id;
  }
  let order = 0;
  for (const i of [...items, ...extraItems].filter((x: any) => !removedSlugs.includes(x.slug)) as any[]) {
    const data = {
      slug: i.slug, categoryId: catIds[moves[i.slug] ?? i.cat], names: renames[i.slug]?.names ?? i.names, descriptions: renames[i.slug]?.descriptions ?? i.desc,
      pricePaise: i.price, imageUrl: String(i.photo).startsWith('/') ? i.photo : img(i.photo), isBestseller: !!i.best, isSpicy: !!i.spicy || details[i.slug]?.spice === 'Spicy', isJain: !!i.isJain || !!details[i.slug]?.jain,
      isVegan: !!details[i.slug]?.vegan, cuisine: details[i.slug]?.cuisine ?? null, tags: details[i.slug]?.tags ?? [], ingredients: details[i.slug]?.ing ?? null,
      allergens: details[i.slug]?.allergens ?? [], spiceLevel: details[i.slug]?.spice ?? null, sortOrder: order++,
    };
    await prisma.menuItem.upsert({ where: { slug: i.slug }, update: data, create: data });
  }
  // Retire old items/categories that no longer belong (only if nothing references them).
  for (const slug of removedSlugs) await prisma.menuItem.deleteMany({ where: { slug, orderItems: { none: {} } } }).catch(() => {});
  await prisma.category.deleteMany({ where: { slug: { notIn: categories.map((c) => c.slug) }, items: { none: {} } } });
  console.log(`Seeded ${categories.length} categories and ${items.length + extraItems.length - removedSlugs.length} demo menu items.`);
}

main().finally(() => prisma.$disconnect());
