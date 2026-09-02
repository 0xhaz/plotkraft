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

/** A card carrying a storyboard panel is far taller than a bare one. */
export const CARD_H_BOARDED = 400;

export function cardHeight(scene: { boarded?: boolean }): number {
  return scene.boarded ? CARD_H_BOARDED : CARD_H;
}

export interface PackedRows {
  positions: Placed[];
  height: number;
}

/**
 * Lay cards out in rows that fit whatever is in them.
 *
 * Two things the earlier fixed-height serpentine got wrong once panels existed.
 *
 * Height: a boarded card is roughly five times the height of a bare one, so
 * spacing every row by the bare height ran tall cards straight through the row
 * below. Each row is now as tall as its tallest card.
 *
 * Direction: boustrophedon was chosen to keep the wrapping *graph* edge short,
 * which is right for a dependency diagram and wrong for a storyboard. A board is
 * read like a page — left to right, every row — and snaking it makes the shot
 * order impossible to follow. So a board with panels reads straight.
 */
export function packRows(
  heights: number[],
  columns = COLUMNS,
  serpentine = false,
): PackedRows {
  const positions: Placed[] = [];
  let y = 0;

  for (let start = 0; start < heights.length; start += columns) {
    const row = heights.slice(start, start + columns);
    const rowHeight = Math.max(...row);

    row.forEach((_, col) => {
      const rowIndex = Math.floor(start / columns);
      const x = serpentine && rowIndex % 2 === 1 ? columns - 1 - col : col;
      positions.push({ x: x * (CARD_W + GAP_X), y });
    });

    y += rowHeight + GAP_Y;
  }

  return { positions, height: Math.max(0, y - GAP_Y) };
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
  collapsed: boolean;
}

/**
 * Above this many scenes a flat board stops being navigable and act grouping
 * becomes the default view. A feature runs to 150-250 scenes; nobody scans that
 * as one grid.
 */
export const LARGE_SCRIPT = 40;

/**
 * Lay scenes out in stacked act bands, preserving script order inside each.
 * Returns both the positions and the band geometry so the canvas can draw and
 * label the regions.
 */
export function actLayout(
  scenes: { id: string; index: number; circleStep?: number; boarded?: boolean }[],
  columns = COLUMNS,
  collapsed: ReadonlySet<Act> = new Set(),
): { positions: Map<string, Placed>; bands: ActBand[]; hidden: Set<string> } {
  const order: Act[] = [1, 2, 3, 0];
  const positions = new Map<string, Placed>();
  const hidden = new Set<string>();
  const bands: ActBand[] = [];

  let cursorY = 0;
  for (const act of order) {
    const inAct = scenes
      .filter((s) => actOfStep(s.circleStep) === act)
      .sort((a, b) => a.index - b.index);
    if (inAct.length === 0) continue;

    const sceneIds = inAct.map((s) => s.id);
    const isCollapsed = collapsed.has(act);

    if (isCollapsed) {
      // A collapsed act keeps its header so it stays a navigable landmark, but
      // its scenes leave the graph entirely rather than being drawn off-screen.
      for (const id of sceneIds) hidden.add(id);
      bands.push({
        act, label: ACT_LABEL[act], y: cursorY, height: ACT_HEADER_H, sceneIds, collapsed: true,
      });
      cursorY += ACT_HEADER_H + GAP_Y;
      continue;
    }

    const bodyTop = cursorY + ACT_HEADER_H;
    const packed = packRows(inAct.map(cardHeight), columns);
    inAct.forEach((s, i) => {
      const p = packed.positions[i];
      positions.set(s.id, { x: p.x, y: bodyTop + p.y });
    });

    const height = ACT_HEADER_H + packed.height + GAP_Y;
    bands.push({ act, label: ACT_LABEL[act], y: cursorY, height, sceneIds, collapsed: false });
    cursorY += height + GAP_Y;
  }

  return { positions, bands, hidden };
}

export const SEQ_HEADER_H = 40;

export interface SequenceMeta {
  order: number;
  name: string;
  purpose: string;
  startIndex: number;
  endIndex: number;
  act: Act;
}

export interface SequenceBand {
  key: string;
  order: number;
  name: string;
  purpose: string;
  act: Act;
  y: number;
  height: number;
  sceneIds: string[];
  collapsed: boolean;
}

export interface Outline {
  positions: Map<string, Placed>;
  actBands: ActBand[];
  seqBands: SequenceBand[];
  hidden: Set<string>;
}

/**
 * The three-level board: act, then sequence, then scenes.
 *
 * Acts alone were not enough — a feature's Act Two ran to 138 cards. The
 * sequence is the rung between them, and collapsing at that level is what turns
 * a 244-scene script into ten readable rows.
 */
export function outlineLayout(
  scenes: { id: string; index: number; circleStep?: number; boarded?: boolean }[],
  sequences: SequenceMeta[],
  collapsedSeqs: ReadonlySet<number>,
  collapsedActs: ReadonlySet<Act>,
  columns = COLUMNS,
): Outline {
  const positions = new Map<string, Placed>();
  const hidden = new Set<string>();
  const actBands: ActBand[] = [];
  const seqBands: SequenceBand[] = [];

  const byIndex = new Map(scenes.map((s) => [s.index, s]));
  const byId = new Map(scenes.map((s) => [s.index, s]));
  const idToIndex = new Map(scenes.map((s) => [s.id, s.index]));
  const packedHeights = new Map<string, number>();
  const ordered = [...sequences].sort((a, b) => a.startIndex - b.startIndex);
  const acts: Act[] = [1, 2, 3, 0];

  let cursorY = 0;

  for (const act of acts) {
    const inAct = ordered.filter((q) => q.act === act);
    if (inAct.length === 0) continue;

    const actTop = cursorY;
    const actSceneIds: string[] = [];
    const actCollapsed = collapsedActs.has(act);
    let innerY = ACT_HEADER_H;

    for (const q of inAct) {
      const sceneIds: string[] = [];
      for (let i = q.startIndex; i <= q.endIndex; i++) {
        const scene = byIndex.get(i);
        if (scene) sceneIds.push(scene.id);
      }
      actSceneIds.push(...sceneIds);

      // A collapsed act hides its sequences' scenes but keeps the sequence rows,
      // so the writer can still read the shape of the act without the cards.
      const seqCollapsed = actCollapsed || collapsedSeqs.has(q.order);

      if (seqCollapsed) {
        for (const id of sceneIds) hidden.add(id);
      } else {
        const inSeq = sceneIds.map((id) => byId.get(idToIndex.get(id) ?? -1));
        const packed = packRows(
          sceneIds.map((_, i) => cardHeight(inSeq[i] ?? {})),
          columns,
        );
        sceneIds.forEach((id, i) => {
          const p = packed.positions[i];
          positions.set(id, { x: p.x, y: actTop + innerY + SEQ_HEADER_H + p.y });
        });
        packedHeights.set(`${act}-${q.order}`, packed.height);
      }

      const height =
        SEQ_HEADER_H + (seqCollapsed ? 0 : (packedHeights.get(`${act}-${q.order}`) ?? 0) + GAP_Y);

      seqBands.push({
        key: `${act}-${q.order}`,
        order: q.order,
        name: q.name,
        purpose: q.purpose,
        act,
        y: actTop + innerY,
        height,
        sceneIds,
        collapsed: seqCollapsed,
      });

      innerY += height + 10;
    }

    actBands.push({
      act,
      label: ACT_LABEL[act],
      y: actTop,
      height: innerY + 8,
      sceneIds: actSceneIds,
      collapsed: actCollapsed,
    });

    cursorY = actTop + innerY + 8 + GAP_Y;
  }

  return { positions, actBands, seqBands, hidden };
}
