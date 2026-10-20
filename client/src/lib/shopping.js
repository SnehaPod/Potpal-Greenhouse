// "Where to buy" links for a plant.
//
// We don't sell plants or pull live listings. Instead we build a search link to
// each retailer for the plant's name, so tapping one opens that shop's own
// results — always current stock, no API keys, nothing stored. The shopper
// sees today's real prices and availability on the retailer's site.

// Each retailer: a label and a function that turns a search term into that
// shop's search URL. Add or remove freely.
const RETAILERS = [
  { name: 'Etsy', url: (q) => `https://www.etsy.com/search?q=${q}` },
  { name: 'Amazon', url: (q) => `https://www.amazon.com/s?k=${q}` },
  { name: 'eBay', url: (q) => `https://www.ebay.com/sch/i.html?_nkw=${q}` },
  { name: 'Google Shopping', url: (q) => `https://www.google.com/search?tbm=shop&q=${q}` },
]

/**
 * Build the list of shopping links for one catalogue plant.
 * @returns [{ name, url }]
 */
export function shoppingLinks(plant) {
  // Search by common name + "plant" (e.g. "Monstera deliciosa plant"); the
  // live plant, not seeds or a print, is what people usually want.
  const term = encodeURIComponent(`${plant.common_name} plant`)
  return RETAILERS.map((shop) => ({ name: shop.name, url: shop.url(term) }))
}
