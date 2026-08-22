export type PastedNoteDraft = {
  title: string;
  description: string;
  specialCase: string;
};

const HEADER_ALIASES = new Set([
  'barcode',
  'title',
  'description',
  'guidelines',
  'special case',
  'specialcase',
]);

function looksLikeHeader(cells: string[]): boolean {
  if (cells.length === 0) return false;
  const first = cells[0]?.trim().toLowerCase() ?? '';
  return HEADER_ALIASES.has(first);
}

/**
 * Parse Excel-style tab-separated paste:
 * col1 barcode (required), col2 description (optional), col3 guidelines (optional).
 */
export function parsePastedNotes(text: string): PastedNoteDraft[] {
  const lines = text.split(/\r\n|\n|\r/);
  const drafts: PastedNoteDraft[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const cells = line.split('\t').map((cell) => cell.trim());
    if (i === 0 && looksLikeHeader(cells)) continue;

    const title = cells[0] ?? '';
    if (!title) continue;

    drafts.push({
      title,
      description: cells[1] ?? '',
      specialCase: cells[2] ?? '',
    });
  }

  return drafts;
}
