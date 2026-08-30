/**
 * Canvas layout for scene cards.
 *
 * Scenes are read in order, so the layout should read in order too. A plain grid
 * wraps left-to-right on every row, which means the edge joining the end of one
 * row to the start of the next crosses the entire canvas — the diagonal that
 * makes a board look tangled.
 *
 * Boustrophedon ("as the ox ploughs") reverses alternate rows, so the last card
 * of a row sits directly above the first card of the next and the wrap becomes a
 * short vertical hop.
 */
export const CARD_W = 260;
export const CARD_H = 78;
export const GAP_X = 96;
export const GAP_Y = 92;
export const COLUMNS = 4;

export interface Placed {
  x: number;
  y: number;
}

export function serpentinePosition(index: number, columns = COLUMNS): Placed {
  const row = Math.floor(index / columns);
  const col = index % columns;
  // Odd rows run right-to-left so consecutive scenes stay adjacent.
  const x = row % 2 === 0 ? col : columns - 1 - col;
  return {
    x: x * (CARD_W + GAP_X),
    y: row * (CARD_H + GAP_Y),
  };
}

export function serpentineLayout(count: number, columns = COLUMNS): Placed[] {
  return Array.from({ length: count }, (_, i) => serpentinePosition(i, columns));
}
