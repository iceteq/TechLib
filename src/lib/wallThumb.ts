/**
 * Client-side wall preview derivative (Google Photos-style small grid tile).
 * Stored beside the original as `{storagePath}.wall.jpg`.
 */

/** Max edge length for wall tiles (~1.5× a ~240px card column). */
export const WALL_THUMB_MAX_EDGE = 360;
/** JPEG quality — aim ~40–80KB for typical photos. */
export const WALL_THUMB_QUALITY = 0.62;

/** Convention: wall preview object key derived from original storage path. */
export function wallDerivativePath(storagePath: string): string {
  return `${storagePath}.wall.jpg`;
}

/**
 * Encode a browser-decodable image into a small JPEG blob for the wall.
 * Returns null if encoding isn't possible (caller should skip derivative).
 */
export async function encodeWallThumb(
  source: Blob,
): Promise<Blob | null> {
  if (typeof createImageBitmap !== 'function') return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source);
  } catch {
    return null;
  }

  try {
    const { width, height } = bitmap;
    if (width < 1 || height < 1) return null;

    const scale = Math.min(1, WALL_THUMB_MAX_EDGE / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', WALL_THUMB_QUALITY);
    });
    return blob;
  } finally {
    bitmap.close();
  }
}
