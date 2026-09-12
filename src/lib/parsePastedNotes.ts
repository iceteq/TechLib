export type PastedNoteDraft = {
  title: string;
  description: string;
  specialCase: string;
};

export type PasteColumn = 'title' | 'description' | 'specialCase';

export type ZippedPasteRows = {
  /** Rows that will be imported (non-empty title). */
  drafts: PastedNoteDraft[];
  /** Full aligned preview, including rows skipped for empty title. */
  preview: Array<PastedNoteDraft & { importable: boolean }>;
  titleCount: number;
  descriptionCount: number;
  specialCaseCount: number;
  orphanDescription: number;
  orphanSpecialCase: number;
};

const HEADER_ALIASES = new Set([
  'barcode',
  'title',
  'part number',
  'partnumber',
  'description',
  'guidelines',
  'guideline',
  'special case',
  'specialcase',
]);

const MAX_IMPORT_ROWS = 500;

export { MAX_IMPORT_ROWS };

function looksLikeHeaderCell(value: string): boolean {
  return HEADER_ALIASES.has(value.trim().toLowerCase());
}

function looksLikeHeaderRow(cells: string[]): boolean {
  // Only the part-number cell decides; other columns may literally say
  // "description" / "guidelines" as content.
  if (cells.length === 0) return false;
  return looksLikeHeaderCell(cells[0] ?? '');
}

/**
 * Split clipboard/column text into lines.
 * Keeps blank lines in the middle (alignment). Strips a single trailing empty
 * line (common Excel artifact).
 */
export function splitColumnLines(text: string): string[] {
  if (!text) return [];
  const normalized = text.replace(/\r\n|\r/g, '\n');
  const lines = normalized.split('\n').map((line) => line.trimEnd());
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.map((line) => line.trim());
}

/**
 * Parse a TSV/CSV-ish clipboard blob with quoted fields (Excel Alt+Enter cells).
 * Prefers tab delimiter when any tab is present; otherwise returns one cell per line.
 */
export function parseDelimitedRows(text: string): string[][] {
  const normalized = text.replace(/\r\n|\r/g, '\n');
  if (!normalized.trim()) return [];

  const hasTab = normalized.includes('\t');
  if (!hasTab) {
    return splitColumnLines(normalized).map((line) => [line]);
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    const next = normalized[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === '\t') {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if (ch === '\n') {
      row.push(cell.trim());
      cell = '';
      // Skip completely empty trailing row from final newline.
      if (!(row.length === 1 && row[0] === '' && i === normalized.length - 1)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    cell += ch;
  }

  row.push(cell.trim());
  if (!(row.length === 1 && row[0] === '' && rows.length > 0)) {
    rows.push(row);
  } else if (rows.length === 0 && row.some((c) => c !== '')) {
    rows.push(row);
  }

  return rows;
}

export function clipboardHasMultipleColumns(text: string): boolean {
  return parseDelimitedRows(text).some((row) => row.length > 1);
}

/**
 * Zip three column arrays by index. Empty titles are previewed but not imported.
 */
function shouldDropSharedHeader(
  titles: string[],
  descriptions: string[],
  specialCases: string[],
): boolean {
  const title = titles[0] ?? '';
  const description = descriptions[0] ?? '';
  const specialCase = specialCases[0] ?? '';
  if (!title && !description && !specialCase) return false;
  if (looksLikeHeaderCell(title)) return true;
  // Title empty but other first cells look like headers (pasted desc/guidelines first).
  if (!title && (looksLikeHeaderCell(description) || looksLikeHeaderCell(specialCase))) {
    return true;
  }
  return false;
}

export function zipPasteColumns(
  titles: string[],
  descriptions: string[],
  specialCases: string[],
): ZippedPasteRows {
  let titleLines = [...titles];
  let descriptionLines = [...descriptions];
  let specialCaseLines = [...specialCases];

  if (shouldDropSharedHeader(titleLines, descriptionLines, specialCaseLines)) {
    titleLines = titleLines.slice(1);
    descriptionLines = descriptionLines.slice(1);
    specialCaseLines = specialCaseLines.slice(1);
  }

  const rowCount = Math.max(
    titleLines.length,
    descriptionLines.length,
    specialCaseLines.length,
  );

  const preview: ZippedPasteRows['preview'] = [];
  const drafts: PastedNoteDraft[] = [];

  for (let i = 0; i < rowCount; i++) {
    const title = titleLines[i] ?? '';
    const description = descriptionLines[i] ?? '';
    const specialCase = specialCaseLines[i] ?? '';
    const importable = Boolean(title);
    const row = { title, description, specialCase, importable };
    preview.push(row);
    if (importable) {
      drafts.push({ title, description, specialCase });
    }
  }

  const cappedDrafts = drafts.slice(0, MAX_IMPORT_ROWS);
  const titleCount = titleLines.filter(Boolean).length;
  const descriptionCount = descriptionLines.filter(Boolean).length;
  const specialCaseCount = specialCaseLines.filter(Boolean).length;

  let orphanDescription = 0;
  let orphanSpecialCase = 0;
  for (const row of preview) {
    if (row.importable) continue;
    if (row.description) orphanDescription += 1;
    if (row.specialCase) orphanSpecialCase += 1;
  }

  return {
    drafts: cappedDrafts,
    preview: preview.slice(0, MAX_IMPORT_ROWS),
    titleCount,
    descriptionCount,
    specialCaseCount,
    orphanDescription,
    orphanSpecialCase,
  };
}

export type ColumnPasteResult = {
  titles: string[];
  descriptions: string[];
  specialCases: string[];
  /** True when clipboard had multiple columns but target was not title. */
  multiColumnIgnored: boolean;
};

/**
 * Apply a clipboard paste into one column.
 * Multi-column TSV only fans out when the target is the title (part number) column.
 */
export function applyColumnPaste(
  target: PasteColumn,
  clipboard: string,
  current: {
    titles: string[];
    descriptions: string[];
    specialCases: string[];
  },
): ColumnPasteResult {
  const rows = parseDelimitedRows(clipboard);
  const multi = rows.some((row) => row.length > 1);

  if (multi && target === 'title') {
    let body = rows;
    if (body.length > 0 && looksLikeHeaderRow(body[0] ?? [])) {
      body = body.slice(1);
    }
    const titles = body.map((row) => row[0] ?? '');
    const descriptions = body.map((row) => row[1] ?? '');
    const specialCases = body.map((row) => row[2] ?? '');
    return {
      titles,
      descriptions,
      specialCases,
      multiColumnIgnored: false,
    };
  }

  if (multi && target !== 'title') {
    // Take only the first cell of each row into the focused column.
    const lines = rows.map((row) => row[0] ?? '');
    return {
      titles: current.titles,
      descriptions: target === 'description' ? lines : current.descriptions,
      specialCases: target === 'specialCase' ? lines : current.specialCases,
      multiColumnIgnored: true,
    };
  }

  const lines = splitColumnLines(clipboard);
  // Drop a header-only first line when pasting into a single column.
  const cleaned =
    lines.length > 0 && looksLikeHeaderCell(lines[0] ?? '')
      ? lines.slice(1)
      : lines;

  return {
    titles: target === 'title' ? cleaned : current.titles,
    descriptions: target === 'description' ? cleaned : current.descriptions,
    specialCases: target === 'specialCase' ? cleaned : current.specialCases,
    multiColumnIgnored: false,
  };
}

/**
 * Parse Excel-style paste from a single blob (legacy / one-shot).
 * col1 part number (required), col2 description, col3 guidelines.
 */
export function parsePastedNotes(text: string): PastedNoteDraft[] {
  const rows = parseDelimitedRows(text);
  if (rows.length === 0) return [];

  let body = rows;
  if (looksLikeHeaderRow(body[0] ?? [])) {
    body = body.slice(1);
  }

  const titles = body.map((row) => row[0] ?? '');
  const descriptions = body.map((row) => row[1] ?? '');
  const specialCases = body.map((row) => row[2] ?? '');
  return zipPasteColumns(titles, descriptions, specialCases).drafts;
}
