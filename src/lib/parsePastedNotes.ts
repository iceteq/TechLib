export type PastedNoteDraft = {
  title: string;
  description: string;
  specialCase: string;
};

/** One import grid row: part number, description, definitions/notes. */
export type PasteGridRow = [string, string, string];

export const PASTE_COL_COUNT = 3;

export const PASTE_NOTE_COLUMNS = [
  { key: 'title', label: 'Part number' },
  { key: 'description', label: 'Description' },
  { key: 'specialCase', label: 'Definitions / notes' },
] as const;

export const EMPTY_PASTE_ROW = (): PasteGridRow => ['', '', ''];

const HEADER_ALIASES = new Set([
  'barcode',
  'title',
  'part number',
  'partnumber',
  'description',
  'guidelines',
  'definitions / notes',
  'definitions/notes',
  'special case',
  'specialcase',
]);

export function looksLikeHeaderRow(cells: readonly string[]): boolean {
  if (cells.length === 0) return false;
  const first = cells[0]?.trim().toLowerCase() ?? '';
  return HEADER_ALIASES.has(first);
}

/**
 * Split clipboard text into a matrix using only tabs and newlines.
 * Spaces and commas are kept inside the cell — they do not create columns.
 */
export function parseClipboardMatrix(text: string): string[][] {
  if (!text) return [];

  let normalized = text;
  if (normalized.endsWith('\r\n')) normalized = normalized.slice(0, -2);
  else if (normalized.endsWith('\n') || normalized.endsWith('\r')) {
    normalized = normalized.slice(0, -1);
  }

  if (!normalized) return [];

  return normalized.split(/\r\n|\n|\r/).map((line) => line.split('\t'));
}

function cloneRows(rows: PasteGridRow[]): PasteGridRow[] {
  return rows.map((row) => [row[0], row[1], row[2]]);
}

/**
 * Paste a clipboard matrix into the grid at (startRow, startCol), Excel-style.
 * Extra columns beyond {@link PASTE_COL_COUNT} are dropped.
 * A leading header row in the clipboard is skipped when it matches known aliases.
 */
export function applyPasteToGrid(
  rows: PasteGridRow[],
  startRow: number,
  startCol: number,
  clipboardText: string,
): PasteGridRow[] {
  let matrix = parseClipboardMatrix(clipboardText);
  if (matrix.length === 0) return rows;

  if (looksLikeHeaderRow(matrix[0] ?? [])) {
    matrix = matrix.slice(1);
    if (matrix.length === 0) return rows;
  }

  const col0 = Math.max(0, Math.min(startCol, PASTE_COL_COUNT - 1));
  const row0 = Math.max(0, startRow);
  const next = cloneRows(rows);

  while (next.length <= row0) next.push(EMPTY_PASTE_ROW());

  for (let r = 0; r < matrix.length; r++) {
    const targetRow = row0 + r;
    while (next.length <= targetRow) next.push(EMPTY_PASTE_ROW());
    const line = matrix[r] ?? [];
    for (let c = 0; c < line.length; c++) {
      const targetCol = col0 + c;
      if (targetCol >= PASTE_COL_COUNT) break;
      next[targetRow]![targetCol] = (line[c] ?? '').trim();
    }
  }

  return next;
}

/** Convert grid rows to import drafts; skips header and empty part-number rows. */
export function draftsFromGrid(rows: PasteGridRow[]): PastedNoteDraft[] {
  const drafts: PastedNoteDraft[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (i === 0 && looksLikeHeaderRow(row)) continue;

    const title = row[0].trim();
    if (!title) continue;

    drafts.push({
      title,
      description: row[1].trim(),
      specialCase: row[2].trim(),
    });
  }

  return drafts;
}

/**
 * Parse Excel-style tab-separated paste into note drafts.
 * col1 part number (required), col2 description, col3 definitions/notes.
 */
export function parsePastedNotes(text: string): PastedNoteDraft[] {
  return draftsFromGrid(applyPasteToGrid([EMPTY_PASTE_ROW()], 0, 0, text));
}
