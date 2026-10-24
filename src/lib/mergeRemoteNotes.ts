import type { NoteWithUrls } from './types';

/** Prefer remote image slots but keep any signed URLs we already have. */
function mergeImages(
  local: NoteWithUrls['images'],
  remote: NoteWithUrls['images'],
): NoteWithUrls['images'] {
  if (remote.length === 0) return remote;
  const localById = new Map(local.map((img) => [img.id, img]));
  return remote.map((img) => {
    const prev = localById.get(img.id);
    if (!prev) return img;
    return {
      ...img,
      url: img.url || prev.url,
      thumbUrl: img.thumbUrl || prev.thumbUrl,
    };
  });
}

function versionMs(note: NoteWithUrls): number {
  if (note.updatedAtIso) {
    const parsed = Date.parse(note.updatedAtIso);
    if (Number.isFinite(parsed)) return parsed;
  }
  return note.updatedAt;
}

/**
 * Merge a batch of remote note snapshots into the wall list.
 * Soft-deleted remotes are removed. Newer local versions win (optimistic saves).
 */
export function mergeRemoteNotesIntoWall(
  prev: NoteWithUrls[],
  remoteBatch: NoteWithUrls[],
): NoteWithUrls[] {
  if (remoteBatch.length === 0) return prev;

  const map = new Map(prev.map((n) => [n.id, n]));

  for (const remote of remoteBatch) {
    if (remote.deletedAt != null) {
      map.delete(remote.id);
      continue;
    }
    const local = map.get(remote.id);
    if (!local) {
      map.set(remote.id, remote);
      continue;
    }
    if (versionMs(local) > versionMs(remote)) {
      continue;
    }
    map.set(remote.id, {
      ...remote,
      images: mergeImages(local.images, remote.images),
    });
  }

  return [...map.values()].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}
