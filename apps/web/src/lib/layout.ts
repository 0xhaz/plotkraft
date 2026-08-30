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

/**
 * Acts, derived from the Story Circle rather than guessed at.
 *
 * The mapping is the conventional one: Act One runs until the protagonist
 * crosses the threshold (steps 1-3), Act Two is the chaos half (4-6), and Act
 * Three begins with the return (7-8). Because the circle is already computed,
 * act grouping costs nothing extra — and a scene the circle could not place
 * lands in "Unplaced" rather than being silently filed under Act One.
 */
export type Act = 1 | 2 | 3 | 0;

export const ACT_LABEL: Record<Act, string> = {
  1: 'Act One — setup, need, crossing',
  2: 'Act Two — trials, finding, the price',
  3: 'Act Three — return and change',
  0: 'Unplaced — run Story Circle to sort these',
};

export function actOfStep(step: number | undefined): Act {
  if (!step || step < 1 || step > 8) return 0;
  if (step <= 3) return 1;
  if (step <= 6) return 2;
  return 3;
}

export const ACT_HEADER_H = 46;

export interface ActBand {
  act: Act;
  label: string;
  y: number;
  height: number;
  sceneIds: string[];
}

/**
 * Lay scenes out in stacked act bands, preserving script order inside each.
 * Returns both the positions and the band geometry so the canvas can draw and
 * label the regions.
 */
export function actLayout(
  scenes: { id: string; index: number; circleStep?: number }[],
  columns = COLUMNS,
): { positions: Map<string, Placed>; bands: ActBand[] } {
  const order: Act[] = [1, 2, 3, 0];
  const positions = new Map<string, Placed>();
  const bands: ActBand[] = [];

  let cursorY = 0;
  for (const act of order) {
    const inAct = scenes
      .filter((s) => actOfStep(s.circleStep) === act)
      .sort((a, b) => a.index - b.index);
    if (inAct.length === 0) continue;

    const rows = Math.ceil(inAct.length / columns);
    const bodyTop = cursorY + ACT_HEADER_H;

    inAct.forEach((s, i) => {
      const p = serpentinePosition(i, columns);
      positions.set(s.id, { x: p.x, y: bodyTop + p.y });
    });

    const height = ACT_HEADER_H + rows * (CARD_H + GAP_Y);
    bands.push({ act, label: ACT_LABEL[act], y: cursorY, height, sceneIds: inAct.map((s) => s.id) });
    cursorY += height + GAP_Y;
  }

  return { positions, bands };
}
