/**
 * Minimal Fountain parser — enough of the spec to turn a screenplay into scenes.
 *
 * Fountain-first is a deliberate scope decision (workplan.md §3, Day 1): it is
 * plain text with unambiguous scene boundaries, so ingest carries no model risk.
 * PDF via Gemini multimodal sits below the cut line.
 *
 * Spec: https://fountain.io/syntax
 */

export interface ParsedDialogue {
  character: string;
  parenthetical?: string;
  text: string;
}

export interface ParsedScene {
  index: number;
  heading: string;
  action: string;
  dialogue: ParsedDialogue[];
  characters: string[];
}

export interface ParsedScript {
  title?: string;
  author?: string;
  scenes: ParsedScene[];
}

const SCENE_HEADING = /^(INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]/i;
const TRANSITION = /^[A-Z\s]+TO:$/;

/** Fountain character cues are uppercase; "(CONT'D)" and "^" (dual dialogue) are noise. */
function isCharacterCue(line: string): boolean {
  const bare = line.replace(/\(.*?\)/g, '').replace(/\^$/, '').trim();
  if (!bare) return false;
  if (SCENE_HEADING.test(bare) || TRANSITION.test(bare)) return false;
  // Must contain a letter, and have no lowercase letters.
  return /[A-Z]/.test(bare) && bare === bare.toUpperCase();
}

function stripBoneyardAndNotes(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\[\[[\s\S]*?\]\]/g, '');
}

/** Title page is `Key: Value` pairs before the first blank-line-separated body. */
function parseTitlePage(lines: string[]): {
  meta: Record<string, string>;
  rest: string[];
} {
  const meta: Record<string, string> = {};
  let i = 0;
  let sawKey = false;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      if (sawKey) {
        i++;
        break;
      }
      i++;
      continue;
    }
    const m = /^([A-Za-z ]+):\s*(.*)$/.exec(line);
    if (!m) break;
    meta[m[1].trim().toLowerCase()] = m[2].trim();
    sawKey = true;
    i++;
  }
  return { meta, rest: sawKey ? lines.slice(i) : lines };
}

export function parseFountain(source: string): ParsedScript {
  const cleaned = stripBoneyardAndNotes(source).replace(/\r\n?/g, '\n');
  const { meta, rest } = parseTitlePage(cleaned.split('\n'));

  const scenes: ParsedScene[] = [];
  let current: ParsedScene | null = null;
  const actionBuffer: string[] = [];

  const flushAction = () => {
    if (current && actionBuffer.length) {
      const text = actionBuffer.join('\n').trim();
      current.action = current.action ? `${current.action}\n${text}` : text;
    }
    actionBuffer.length = 0;
  };

  for (let i = 0; i < rest.length; i++) {
    const raw = rest[i];
    const line = raw.trim();

    // Forced scene heading: a line starting with a single "." (but not "..").
    const forced = line.startsWith('.') && !line.startsWith('..');
    if (SCENE_HEADING.test(line) || forced) {
      flushAction();
      current = {
        index: scenes.length,
        heading: (forced ? line.slice(1) : line).trim().toUpperCase(),
        action: '',
        dialogue: [],
        characters: [],
      };
      scenes.push(current);
      continue;
    }

    if (!current) continue; // Pre-scene preamble is not part of any scene.
    if (line === '') {
      actionBuffer.push('');
      continue;
    }
    if (TRANSITION.test(line) || line.startsWith('>')) continue;

    // A character cue is an uppercase line immediately followed by non-blank text.
    const next = rest[i + 1]?.trim() ?? '';
    if (isCharacterCue(line) && next !== '') {
      flushAction();
      const character = line
        .replace(/\(.*?\)/g, '')
        .replace(/\^$/, '')
        .trim();

      let j = i + 1;
      let parenthetical: string | undefined;
      const textParts: string[] = [];
      while (j < rest.length && rest[j].trim() !== '') {
        const d = rest[j].trim();
        if (d.startsWith('(') && d.endsWith(')')) parenthetical = d;
        else textParts.push(d);
        j++;
      }

      current.dialogue.push({
        character,
        ...(parenthetical ? { parenthetical } : {}),
        text: textParts.join(' '),
      });
      if (!current.characters.includes(character)) current.characters.push(character);
      i = j - 1;
      continue;
    }

    actionBuffer.push(line);
  }
  flushAction();

  return {
    ...(meta.title ? { title: meta.title } : {}),
    ...(meta.author ? { author: meta.author } : {}),
    scenes,
  };
}
