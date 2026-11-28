// What the website's /subscription page sells, and for how much. This is the
// source of truth for charging: the website only ever sends an item key, never
// a price. Keep the names/prices in step with digitag-website
// app/subscription/page.tsx (the page shows them; this file charges them).
// Amounts are in paise; GST (18%) is added on top at checkout.

const GST_RATE = 0.18;
const PACKAGE_DAYS = 30;

const PACKAGES = {
  start: { name: 'Digi Start', price: 7999_00 },
  rise: { name: 'Digi Rise', price: 14999_00 },
  pro: { name: 'Digi Pro', price: 29999_00 },
  max: { name: 'Digi Max', price: 49999_00 },
};

// Starting prices. "CGI Advertisement" is custom-quoted, so it isn't sold here.
const SERVICES = {
  'basic-reel-editing': { name: 'Basic Reel Editing', price: 599_00 },
  'advanced-reel-editing': { name: 'Advanced Reel Editing', price: 1499_00 },
  'long-format-video-editing': { name: 'Long-Format Video Editing', price: 2499_00 },
  scriptwriting: { name: 'Scriptwriting', price: 399_00 },
  'concept-creation': { name: 'Concept Creation', price: 499_00 },
  'voice-over': { name: 'Voice-Over', price: 699_00 },
  'reel-cover-design': { name: 'Reel Cover Design', price: 299_00 },
  'video-shooting-day': { name: 'Video Shooting (Per Day)', price: 5999_00 },
  'ai-video-creation': { name: 'AI Video Creation', price: 2499_00 },
  'podcast-editing': { name: 'Podcast Editing', price: 4999_00 },
};

/** Price breakdown for one item, or null if the key isn't sold. */
function quote(itemType, itemKey) {
  const table = itemType === 'PACKAGE' ? PACKAGES : itemType === 'SERVICE' ? SERVICES : null;
  const item = table && Object.prototype.hasOwnProperty.call(table, itemKey) ? table[itemKey] : null;
  if (!item) return null;
  const gstAmount = Math.round(item.price * GST_RATE);
  return {
    itemType,
    itemKey,
    itemName: item.name,
    baseAmount: item.price,
    gstAmount,
    totalAmount: item.price + gstAmount,
    currency: 'INR',
  };
}

function catalog() {
  const list = (type, table) => Object.keys(table).map((key) => quote(type, key));
  return { gstRate: GST_RATE, packageDays: PACKAGE_DAYS, packages: list('PACKAGE', PACKAGES), services: list('SERVICE', SERVICES) };
}

module.exports = { GST_RATE, PACKAGE_DAYS, PACKAGES, SERVICES, quote, catalog };
