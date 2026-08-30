import type { ParsedScene, ParsedScript, ParsedDialogue } from './fountain.parser';

/**
 * Turn positioned PDF text into a screenplay.
 *
 * A screenplay PDF carries its structure in the left margin, not in the words:
 * sluglines and action sit at the 1.5" margin, dialogue about an inch further in,
 * parentheticals further still, and character cues furthest of all. Reading the
 * indentation is far more reliable than guessing from the text — "MAYA" as a cue
 * and "MAYA SLAMS THE DOOR" as action are both uppercase, and only their
 * position tells them apart.
 *
 * Margins vary by software and by scan, so every threshold below is relative to
 * the document's own action margin rather than an absolute inch measurement.
 */

export interface TextLine {
  text: string;
  /** Left edge, in PDF points (72 per inch). */
  x: number;
  /** Baseline from the top of the page. */
  y: number;
  page: number;
}

const SCENE_HEADING = /^(INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]/i;
const TRANSITION = /^[A-Z\s]+TO:$/;
/** Page numbers, scene numbers, and revision marks that are not script content. */
const FURNITURE = /^(\d+[.:]?|\(MORE\)|\(CONT'D\)|CONTINUED:?|OMITTED|\*)$/i;

/** Indents relative to the action margin, in points. 72pt = 1 inch. */
const DIALOGUE_INDENT = 40;
const CHARACTER_INDENT = 120;

/** Most common left edge among the given lines, in 6pt buckets. */
function modeOfX(lines: TextLine[]): number {
  const buckets = new Map<number, number>();
  for (const line of lines) {
    // 6pt buckets absorb sub-character jitter in the extracted positions.
    const bucket = Math.round(line.x / 6) * 6;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }
  let best = 0;
  let bestCount = -1;
  for (const [bucket, count] of buckets) {
    if (count > bestCount || (count === bestCount && bucket < best)) {
      best = bucket;
      bestCount = count;
    }
  }
  return best;
}

/**
 * The action margin, anchored on sluglines.
 *
 * A slugline sits at the action margin by definition, which makes it a far
 * better reference than the document's overall statistics. The mode of all
 * lines fails on dialogue-heavy pages — a two-hander can easily have more
 * dialogue lines than action ones, which would set the baseline an inch too far
 * right and reclassify every character cue as dialogue. Taking the minimum x
 * fails differently: one revision asterisk in the far margin drags it left.
 * Sluglines avoid both.
 */
export function actionMargin(lines: TextLine[]): number {
  const headings = lines.filter((l) => SCENE_HEADING.test(l.text.trim()));
  if (headings.length > 0) return modeOfX(headings);
  return modeOfX(lines);
}

export type LineKind = 'heading' | 'action' | 'character' | 'parenthetical' | 'dialogue' | 'skip';

export function classify(line: TextLine, margin: number): LineKind {
  const text = line.text.trim();
  if (!text || FURNITURE.test(text)) return 'skip';

  const indent = line.x - margin;

  if (SCENE_HEADING.test(text)) return 'heading';
  if (TRANSITION.test(text)) return 'skip';

  // Shape settles what indentation leaves ambiguous: parentheticals and
  // character cues sit at similar depths in many templates.
  if (text.startsWith('(') && text.endsWith(')')) return 'parenthetical';

  if (indent >= CHARACTER_INDENT) {
    const bare = text.replace(/\(.*?\)/g, '').trim();
    if (bare && bare === bare.toUpperCase() && /[A-Z]/.test(bare)) return 'character';
    return 'dialogue';
  }

  if (indent >= DIALOGUE_INDENT) return 'dialogue';
  return 'action';
}

export function parseScreenplayLines(lines: TextLine[]): ParsedScript {
  const margin = actionMargin(lines);

  const scenes: ParsedScene[] = [];
  let current: ParsedScene | null = null;
  let pendingCharacter: string | null = null;
  let pendingParenthetical: string | undefined;
  let pendingText: string[] = [];
  const action: string[] = [];

  const flushDialogue = () => {
    if (current && pendingCharacter && pendingText.length) {
      current.dialogue.push({
        character: pendingCharacter,
        ...(pendingParenthetical ? { parenthetical: pendingParenthetical } : {}),
        text: pendingText.join(' '),
      } as ParsedDialogue);
      if (!current.characters.includes(pendingCharacter)) {
        current.characters.push(pendingCharacter);
      }
    }
    pendingCharacter = null;
    pendingParenthetical = undefined;
    pendingText = [];
  };

  const flushAction = () => {
    if (current && action.length) {
      const text = action.join(' ').trim();
      current.action = current.action ? `${current.action}\n${text}` : text;
    }
    action.length = 0;
  };

  for (const line of lines) {
    const kind = classify(line, margin);
    const text = line.text.trim();

    if (kind === 'skip') continue;

    if (kind === 'heading') {
      flushDialogue();
      flushAction();
      current = {
        index: scenes.length,
        heading: text.toUpperCase(),
        action: '',
        dialogue: [],
        characters: [],
      };
      scenes.push(current);
      continue;
    }

    if (!current) continue; // Title page and anything before the first slugline.

    if (kind === 'character') {
      flushDialogue();
      flushAction();
      // "(CONT'D)" and dual-dialogue carets are not part of the name.
      pendingCharacter = text.replace(/\(.*?\)/g, '').replace(/\^$/, '').trim();
      continue;
    }

    if (kind === 'parenthetical') {
      if (pendingCharacter) pendingParenthetical = text;
      continue;
    }

    if (kind === 'dialogue') {
      if (pendingCharacter) pendingText.push(text);
      else action.push(text); // Indented text with no cue above it reads as action.
      continue;
    }

    flushDialogue();
    action.push(text);
  }

  flushDialogue();
  flushAction();

  return { scenes };
}
