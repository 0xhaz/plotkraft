/**
 * Choosing which scenes to board.
 *
 * A feature runs to 250 scenes; boarding all of them costs real money and buries
 * the few images worth looking at. The agents already know which scenes carry
 * the film, so the selection is a ranking rather than a guess.
 *
 * Load score alone is not enough. It measures how much hangs off a scene
 * structurally, which can crown a well-connected but unremarkable beat. Crossing
 * it with the scene's place on the circle favours the moments that carry meaning
 * as well as weight — the price paid, the thing found, the threshold crossed.
 */

export interface BoardCandidate {
  sceneId: string;
  index: number;
  heading: string;
  action: string;
  loadScore: number;
  circleStep?: number;
}

/**
 * How much each step earns. Take and Find are where a film turns; Search is the
 * long middle and is over-represented by sheer scene count, so it is damped.
 */
const STEP_WEIGHT: Record<number, number> = {
  1: 0.7, // You
  2: 0.8, // Need
  3: 1.0, // Go — the threshold
  4: 0.5, // Search — long, and rarely the image you want
  5: 1.0, // Find
  6: 1.2, // Take — the price, usually the strongest single frame
  7: 0.9, // Return
  8: 1.0, // Change
};

export function boardScore(candidate: BoardCandidate): number {
  const weight = STEP_WEIGHT[candidate.circleStep ?? 0] ?? 0.6;
  // A scene with no action text has nothing to draw from, whatever it scores.
  const drawable = candidate.action.trim().length > 40 ? 1 : 0.25;
  return (0.25 + candidate.loadScore) * weight * drawable;
}

/**
 * Pick the scenes to board, spread across the script.
 *
 * Ranking alone clusters: the highest-scoring scenes sit together in the same
 * stretch, and a board of eight images from one sequence shows the writer
 * nothing about the shape of the film. So the script is divided into as many
 * windows as there are panels, and each window contributes its best scene.
 */
export function selectForBoards(candidates: BoardCandidate[], panels = 8): BoardCandidate[] {
  if (candidates.length === 0 || panels <= 0) return [];
  if (candidates.length <= panels) {
    return [...candidates].sort((a, b) => a.index - b.index);
  }

  const ordered = [...candidates].sort((a, b) => a.index - b.index);
  const windowSize = ordered.length / panels;
  const picked: BoardCandidate[] = [];

  for (let i = 0; i < panels; i++) {
    const from = Math.floor(i * windowSize);
    const to = Math.max(from + 1, Math.floor((i + 1) * windowSize));
    const window = ordered.slice(from, to);
    if (window.length === 0) continue;

    const best = window.reduce((a, b) => (boardScore(b) > boardScore(a) ? b : a));
    picked.push(best);
  }

  return picked;
}
