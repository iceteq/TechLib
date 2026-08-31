import { NOTE_DRAG_MIME } from './noteDrag';

/** Image files from a paste clipboard. */
export function clipboardImageFiles(
  clipboardData: DataTransfer | null,
): File[] {
  if (!clipboardData) return [];
  const fromItems = Array.from(clipboardData.items)
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
  if (fromItems.length > 0) return fromItems;
  return Array.from(clipboardData.files).filter((file) =>
    file.type.startsWith('image/'),
  );
}

/** Image files from a drag-and-drop DataTransfer (ignores note-assign drags). */
export function dataTransferImageFiles(dataTransfer: DataTransfer): File[] {
  if (Array.from(dataTransfer.types).includes(NOTE_DRAG_MIME)) return [];
  return Array.from(dataTransfer.files).filter((file) =>
    file.type.startsWith('image/'),
  );
}

export function clipboardHasPlainText(clipboardData: DataTransfer | null): boolean {
  if (!clipboardData) return false;
  if (!Array.from(clipboardData.types).includes('text/plain')) return false;
  return Boolean(clipboardData.getData('text/plain').trim());
}
