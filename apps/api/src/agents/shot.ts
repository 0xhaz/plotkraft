export interface Shot {
  sceneIndex: number;
  size: string;
  angle: string;
  movement: string;
  subject: string;
  staging: string;
  why: string;
}

/**
 * The slug a board carries under each panel, in the form a crew reads.
 * "MCU — low angle — dolly in" tells a DP more than a paragraph does.
 */
export function shotSlug(shot: Pick<Shot, 'size' | 'angle' | 'movement'>): string {
  const parts = [shot.size, shot.angle];
  if (shot.movement && shot.movement !== 'static') parts.push(shot.movement);
  return parts.join(' · ');
}

/**
 * Turn a shot into drawing instructions.
 *
 * The camera choice has to reach the image model as composition, not as jargon:
 * an image model does not know what "MCU, low angle" means, but it does know
 * "framed from the chest up, camera below eye line looking up".
 */
const SIZE_HINT: Record<string, string> = {
  'extreme wide': 'the figures tiny in a vast space, landscape dominating the frame',
  wide: 'the whole space visible, figures small within it',
  full: 'figures head to toe, the room around them',
  'medium wide': 'figures from the knees up',
  medium: 'figures from the waist up',
  'medium close-up': 'framed from the chest up',
  'close-up': 'the head and shoulders filling the frame',
  'extreme close-up': 'a single detail filling the whole frame',
  'over-the-shoulder': 'seen past the shoulder of a figure in the near foreground',
  'two-shot': 'two figures sharing the frame',
  insert: 'a single object filling the frame, no figures',
  POV: 'the frame is what a character sees, first person',
};

const ANGLE_HINT: Record<string, string> = {
  'eye level': 'camera at eye height, level',
  'low angle': 'camera below eye line looking up, the subject towering',
  'high angle': 'camera above looking down, the subject diminished',
  overhead: 'camera directly above looking straight down',
  dutch: 'camera tilted off horizontal, the frame canted',
  'ground level': 'camera on the floor looking along it',
};

export function shotToComposition(shot: Pick<Shot, 'size' | 'angle' | 'movement' | 'staging'>): string {
  const size = SIZE_HINT[shot.size] ?? shot.size;
  const angle = ANGLE_HINT[shot.angle] ?? shot.angle;
  const move =
    shot.movement && shot.movement !== 'static'
      ? ` Suggest a ${shot.movement} with a motion arrow.`
      : '';
  return `Framing: ${size}. Camera: ${angle}.${move} Staging: ${shot.staging}`;
}
