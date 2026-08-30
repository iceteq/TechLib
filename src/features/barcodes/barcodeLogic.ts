/**
 * Derive a Code 128-friendly barcode value from a note part number (title).
 * Keeps generation separate from Note persistence / UI.
 */
export function barcodeValueFromTitle(title: string): string {
  const cleaned = title
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return cleaned || 'NO-PART';
}
