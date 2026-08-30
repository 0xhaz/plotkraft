import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { parseScreenplayLines, type TextLine } from './pdf-screenplay';
import type { ParsedScript } from './fountain.parser';

/** Text items closer than this vertically belong to the same visual line. */
const LINE_TOLERANCE = 3;

/** A horizontal gap wider than this between runs stands in for a space. */
const SPACE_GAP = 1;

/**
 * Rejoin the text runs of one line, restoring the spaces between them.
 *
 * PDF encodes inter-word spacing as position rather than as space characters,
 * so concatenating the runs directly yields "INT.NEWSROOM-NIGHT". Where one run
 * ends and the next begins further right, that gap was a space.
 */
function joinRuns(parts: { x: number; width: number; s: string }[]): string {
  const sorted = [...parts].sort((a, b) => a.x - b.x);
  let out = '';
  let cursor: number | null = null;

  for (const part of sorted) {
    if (cursor !== null && part.x - cursor > SPACE_GAP && !/\s$/.test(out) && !/^\s/.test(part.s)) {
      out += ' ';
    }
    out += part.s;
    cursor = part.x + part.width;
  }
  return out;
}

@Injectable()
export class PdfService {
  private readonly log = new Logger(PdfService.name);

  /**
   * Extract positioned text from a screenplay PDF and parse it.
   *
   * pdfjs gives one item per text run with a transform matrix; runs are grouped
   * back into visual lines by baseline, because a single line of dialogue often
   * arrives as several runs and only the leftmost one carries the true indent.
   */
  async parse(bytes: Buffer): Promise<ParsedScript> {
    // pdfjs-dist ships as ESM; a dynamic import keeps this CommonJS build working.
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

    const doc = await pdfjs.getDocument({
      data: new Uint8Array(bytes),
      // A screenplay needs no font rendering; we only want positions and text.
      disableFontFace: true,
    }).promise;

    const lines: TextLine[] = [];

    for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
      const page = await doc.getPage(pageNo);
      const content = await page.getTextContent();

      // Group runs into lines by baseline y.
      type Part = { x: number; width: number; s: string };
      const rows = new Map<number, { x: number; y: number; parts: Part[] }>();

      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const x = item.transform[4] as number;
        const y = item.transform[5] as number;
        const part: Part = { x, width: item.width ?? 0, s: item.str };

        const key = [...rows.keys()].find((k) => Math.abs(k - y) <= LINE_TOLERANCE);
        if (key === undefined) {
          rows.set(y, { x, y, parts: [part] });
        } else {
          const row = rows.get(key)!;
          row.parts.push(part);
          row.x = Math.min(row.x, x);
        }
      }

      for (const row of [...rows.values()].sort((a, b) => b.y - a.y)) {
        const text = joinRuns(row.parts).replace(/\s+/g, ' ').trim();
        if (text) lines.push({ text, x: row.x, y: row.y, page: pageNo });
      }
    }

    const parsed = parseScreenplayLines(lines);
    this.log.log(
      `pdf: ${doc.numPages} pages, ${lines.length} lines, ${parsed.scenes.length} scenes`,
    );

    if (parsed.scenes.length === 0) {
      throw new BadRequestException(
        'No scene headings found. This may be a scan without a text layer, or not a screenplay.',
      );
    }

    return parsed;
  }
}
