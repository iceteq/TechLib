import type { PhotoSource } from './types';

export const PHOTO_SOURCES: {
  id: PhotoSource;
  label: string;
  short: string;
  hint: string;
}[] = [
  {
    id: 'po',
    label: 'PO',
    short: 'Purchase order',
    hint: 'Brand-new part from a purchase order',
  },
  {
    id: 'pick',
    label: 'Pick',
    short: 'Pick location',
    hint: 'From a pick location — may mix new and returned stock',
  },
  {
    id: 'return',
    label: 'Return',
    short: 'Return',
    hint: 'From a customer return — may be incomplete',
  },
];

const PHOTO_SOURCE_IDS = new Set<string>(PHOTO_SOURCES.map((s) => s.id));

export function parsePhotoSource(
  value: string | null | undefined,
): PhotoSource | null {
  if (!value) return null;
  return PHOTO_SOURCE_IDS.has(value) ? (value as PhotoSource) : null;
}

export function photoSourceMeta(source: PhotoSource | null | undefined) {
  if (!source) return null;
  return PHOTO_SOURCES.find((s) => s.id === source) ?? null;
}

export function photoSourceColorVars(source: PhotoSource): {
  bg: string;
  fg: string;
  border: string;
} {
  const map: Record<PhotoSource, { bg: string; fg: string; border: string }> = {
    po: {
      bg: 'rgba(30, 142, 62, 0.16)',
      fg: '#0d652d',
      border: 'rgba(30, 142, 62, 0.38)',
    },
    pick: {
      bg: 'rgba(217, 158, 0, 0.16)',
      fg: '#8a5a00',
      border: 'rgba(217, 158, 0, 0.4)',
    },
    return: {
      bg: 'rgba(217, 48, 37, 0.14)',
      fg: '#a50e0e',
      border: 'rgba(217, 48, 37, 0.34)',
    },
  };
  return map[source];
}
