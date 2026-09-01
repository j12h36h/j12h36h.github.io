export const GALACTIC_MODE_ID = 'galactic-dominion';
export const GALACTIC_MODE_NAME = 'GALACTIC DOMINION';
export const GALACTIC_BOARD_SIZE = 24;
export const GALACTIC_QUARANTINE_INDEX = 12;

const property = (id, name, sector, cost, rent, developmentCost) => Object.freeze({
  id, name, type: 'property', sector, cost, rent: Object.freeze(rent), developmentCost
});
const warp = (id, name) => Object.freeze({ id, name, type: 'warp', cost: 200 });
const special = (id, name, type, extra = {}) => Object.freeze({ id, name, type, ...extra });

export const GALACTIC_SECTORS = Object.freeze({
  aurora: Object.freeze({ id: 'aurora', name: 'AURORA SECTOR' }),
  ember: Object.freeze({ id: 'ember', name: 'EMBER SECTOR' }),
  verdant: Object.freeze({ id: 'verdant', name: 'VERDANT SECTOR' }),
  umbra: Object.freeze({ id: 'umbra', name: 'UMBRA SECTOR' }),
  titan: Object.freeze({ id: 'titan', name: 'TITAN SECTOR' }),
  solar: Object.freeze({ id: 'solar', name: 'SOLAR SECTOR' })
});

export const GALACTIC_BOARD = Object.freeze([
  special('dominion-gate', 'DOMINION GATE', 'start'),
  property('aster-prime', 'ASTER PRIME', 'aurora', 120, [10, 30, 90, 180, 320], 75),
  property('lyra-station', 'LYRA STATION', 'aurora', 140, [12, 36, 100, 200, 350], 75),
  special('anomaly-alpha', 'ANOMALY', 'anomaly'),
  property('cinder', 'CINDER', 'ember', 160, [14, 42, 120, 230, 400], 100),
  property('vesta', 'VESTA', 'ember', 180, [16, 48, 135, 260, 450], 100),
  warp('sol-warp-gate', 'SOL WARP GATE'),
  property('kestrel', 'KESTREL', 'verdant', 200, [18, 54, 150, 290, 500], 125),
  property('eos', 'EOS', 'verdant', 220, [20, 60, 170, 320, 550], 125),
  special('federation-tariff-a', 'FEDERATION TARIFF', 'tax', { amount: 120 }),
  property('nyx', 'NYX', 'umbra', 240, [22, 66, 190, 360, 620], 150),
  property('noctis', 'NOCTIS', 'umbra', 260, [24, 72, 210, 400, 680], 150),
  special('quarantine', 'QUARANTINE', 'quarantine'),
  property('atlas', 'ATLAS', 'titan', 280, [26, 78, 230, 440, 760], 175),
  property('hyperion', 'HYPERION', 'titan', 300, [28, 84, 250, 480, 820], 175),
  special('anomaly-beta', 'ANOMALY', 'anomaly'),
  property('helios', 'HELIOS', 'solar', 320, [30, 90, 275, 520, 900], 200),
  property('zenith', 'ZENITH', 'solar', 350, [34, 102, 310, 580, 1000], 200),
  warp('rim-warp-gate', 'RIM WARP GATE'),
  special('trade-winds', 'TRADE WINDS', 'rest'),
  special('anomaly-gamma', 'ANOMALY', 'anomaly'),
  special('federation-tariff-b', 'FEDERATION TARIFF', 'tax', { amount: 150 }),
  special('free-orbit', 'FREE ORBIT', 'rest'),
  special('deep-space', 'DEEP SPACE', 'rest')
]);

export const GALACTIC_PURCHASABLES = Object.freeze(GALACTIC_BOARD.filter(space => space.type === 'property' || space.type === 'warp'));

export const GALACTIC_ANOMALIES = Object.freeze([
  Object.freeze({ id: 'salvage', label: 'SALVAGE CACHE // +100', balanceDelta: 100 }),
  Object.freeze({ id: 'pirates', label: 'PIRATE RAID // -75', balanceDelta: -75 }),
  Object.freeze({ id: 'trade-boom', label: 'TRADE BOOM // +50', balanceDelta: 50 }),
  Object.freeze({ id: 'solar-loss', label: 'SOLAR FLARE DAMAGE // -50', balanceDelta: -50 }),
  Object.freeze({ id: 'wormhole', label: 'WORMHOLE // RETURN TO DOMINION GATE', moveTo: 0 }),
  Object.freeze({ id: 'inspection', label: 'FEDERATION INSPECTION // QUARANTINE', moveTo: GALACTIC_QUARANTINE_INDEX, quarantineTurns: 1 })
]);

export function galacticSettings(worldSettings = {}) {
  return {
    currencyName: String(worldSettings?.currency?.name || 'GALACTIC CREDITS').slice(0, 18),
    currencySymbol: String(worldSettings?.currency?.symbol || '✦').slice(0, 3),
    startingBalance: Math.max(0, Math.min(1000000, Math.floor(Number(worldSettings?.currency?.startingBalance ?? 1500)))),
    startSalary: Math.max(0, Math.min(10000, Math.floor(Number(worldSettings?.galactic?.startSalary ?? 200)))),
    maxRounds: Math.max(5, Math.min(200, Math.floor(Number(worldSettings?.galactic?.maxRounds ?? 50)))),
    developmentEnabled: worldSettings?.galactic?.developmentEnabled !== false
  };
}

export function boardSpace(index) {
  const normalized = ((Number(index) % GALACTIC_BOARD_SIZE) + GALACTIC_BOARD_SIZE) % GALACTIC_BOARD_SIZE;
  return GALACTIC_BOARD[normalized];
}

export function sectorSpaces(sectorId) {
  return GALACTIC_BOARD.filter(space => space.type === 'property' && space.sector === sectorId);
}

export function ownsSector(game, profileId, sectorId) {
  const spaces = sectorSpaces(sectorId);
  return !!profileId && spaces.length > 0 && spaces.every(space => game?.ownership?.[space.id]?.ownerId === profileId);
}

export function warpCountOwned(game, profileId) {
  return GALACTIC_BOARD.filter(space => space.type === 'warp' && game?.ownership?.[space.id]?.ownerId === profileId).length;
}

export function rentForSpace(game, space) {
  const holding = game?.ownership?.[space?.id];
  if (!space || !holding?.ownerId) return 0;
  if (space.type === 'warp') return warpCountOwned(game, holding.ownerId) >= 2 ? 100 : 40;
  if (space.type !== 'property') return 0;
  const level = Math.max(0, Math.min(4, Math.floor(Number(holding.level || 0))));
  const base = Number(space.rent?.[level] || 0);
  return level === 0 && ownsSector(game, holding.ownerId, space.sector) ? base * 2 : base;
}

export function canDevelopSpace(game, profileId, space, settings) {
  if (!settings?.developmentEnabled || space?.type !== 'property') return false;
  const holding = game?.ownership?.[space.id];
  return holding?.ownerId === profileId && Number(holding.level || 0) < 4 && ownsSector(game, profileId, space.sector);
}

export function playerNetWorth(game, profileId) {
  const player = game?.players?.[profileId];
  if (!player) return 0;
  let total = Math.max(0, Number(player.balance || 0));
  for (const space of GALACTIC_PURCHASABLES) {
    const holding = game?.ownership?.[space.id];
    if (holding?.ownerId !== profileId) continue;
    total += Number(space.cost || 0);
    if (space.type === 'property') total += Math.max(0, Number(holding.level || 0)) * Number(space.developmentCost || 0);
  }
  return Math.floor(total);
}

export function freshOwnership() {
  return Object.fromEntries(GALACTIC_PURCHASABLES.map(space => [space.id, { ownerId: '', level: 0 }]));
}

export function boardGridPosition(index) {
  const i = ((Number(index) % 24) + 24) % 24;
  if (i <= 6) return { row: 7, col: 7 - i };
  if (i <= 12) return { row: 13 - i, col: 1 };
  if (i <= 18) return { row: 1, col: i - 11 };
  return { row: i - 17, col: 7 };
}
