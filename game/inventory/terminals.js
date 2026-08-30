/**
 * E.R.A.S. TERMINAL REGISTRY
 * -------------------------
 * Each terminal owns its own offer list. The inventory popup reads this file
 * generically, so adding/changing a terminal does not require editing the UI.
 *
 * A terminal id should match the tactical object's targetId.
 */
const TERMINAL_DEFINITIONS = {
  'north-terminal': {
    name: 'NORTH TERMINAL',
    subtitle: 'NORTH PLATFORM',
    offers: [
      { id: 'buy-health-potion', direction: 'buy', itemId: 'health_potion', price: 3 },
      { id: 'buy-stick', direction: 'buy', itemId: 'stick', price: 5 },
      { id: 'sell-slime-juice', direction: 'sell', itemId: 'slime_juice', price: 1 }
    ]
  }
};

export const GAME_TERMINALS = Object.freeze(Object.fromEntries(
  Object.entries(TERMINAL_DEFINITIONS).map(([id, terminal]) => [id, Object.freeze({
    id,
    ...terminal,
    offers: Object.freeze((terminal.offers || []).map(offer => Object.freeze({ ...offer })))
  })])
));

export function terminalMeta(terminalId = '') {
  return GAME_TERMINALS[String(terminalId || '')] || null;
}

export function terminalOffer(terminalId = '', offerId = '') {
  return terminalMeta(terminalId)?.offers?.find(offer => offer.id === offerId) || null;
}

export function isGameTerminal(terminalId = '') {
  return Boolean(terminalMeta(terminalId));
}
