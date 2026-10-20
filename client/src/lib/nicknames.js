// Starter nicknames for newly identified plants ("Add Miso to my plants").
// Users can always type their own; this just makes the first guess fun and fresh.
//
//   pickNickname(['Miso', 'Pip'])  → a random name that isn't already in the crew

export const NICKNAMES = [
  // Snacks and sweet things
  'Miso', 'Mochi', 'Pickle', 'Olive', 'Basil', 'Peanut', 'Biscuit', 'Waffle', 'Noodle', 'Dumpling',
  'Toffee', 'Nutmeg', 'Ginger', 'Pepper', 'Mango', 'Kiwi', 'Bean', 'Tofu', 'Bao', 'Churro',
  'Taco', 'Nacho', 'Muffin', 'Cookie', 'Truffle', 'Pudding', 'Marshmallow', 'Sesame', 'Wasabi', 'Matcha',
  'Chai', 'Jalebi', 'Laddoo', 'Pista', 'Kaju', 'Gulab', 'Barfi', 'Masala', 'Elaichi', 'Kesar',
  // Nature
  'Sprout', 'Fern', 'Clover', 'Juniper', 'Willow', 'Sage', 'Ivy', 'Moss', 'Maple', 'Hazel',
  'Aspen', 'Cedar', 'Briar', 'Thistle', 'Petal', 'Bramble', 'Acorn', 'Pebble', 'Rain', 'Sunny',
  'Breeze', 'Monsoon', 'Tulsi', 'Neem', 'Jasmine', 'Lotus', 'Meadow', 'Rowan', 'Laurel', 'Wren',
  // Cosy and cute
  'Pip', 'Dumbo', 'Bubbles', 'Ziggy', 'Pixel', 'Doodle', 'Button', 'Pudge', 'Sunbeam', 'Zuzu',
  'Bo', 'Mimi', 'Lulu', 'Kiki', 'Fizz', 'Wiggles', 'Snooze', 'Cosmo', 'Luna', 'Nova',
  'Jelly', 'Poppy', 'Tink', 'Bumble', 'Gizmo', 'Squiggle', 'Twig', 'Leafy', 'Frond', 'Sir Leafalot',
]

/**
 * A random nickname that isn't already used in the crew.
 * @param {string[]} taken  the nicknames of the user's plants (any case)
 */
export function pickNickname(taken = []) {
  const used = new Set(taken.map((name) => name.trim().toLowerCase()))
  const unique = [...new Set(NICKNAMES)] // the list may repeat a name; don't let that skew the odds
  const fresh = unique.filter((name) => !used.has(name.toLowerCase()))

  if (fresh.length) return fresh[Math.floor(Math.random() * fresh.length)]

  // Every name is taken (that's a big crew!): number one instead, e.g. "Miso 2"
  const base = unique[Math.floor(Math.random() * unique.length)]
  let n = 2
  while (used.has(`${base} ${n}`.toLowerCase())) n++
  return `${base} ${n}`
}
