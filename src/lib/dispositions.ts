import type { NoteDisposition } from './types';

export function dispositionColorVars(id: NoteDisposition): {
  bg: string;
  fg: string;
  border: string;
} | null {
  if (id === 'none') return null;
  const map: Record<
    Exclude<NoteDisposition, 'none'>,
    { bg: string; fg: string; border: string }
  > = {
    stock: {
      bg: 'rgba(30, 142, 62, 0.14)',
      fg: '#0d652d',
      border: 'rgba(30, 142, 62, 0.35)',
    },
    repair: {
      bg: 'rgba(217, 48, 37, 0.12)',
      fg: '#a50e0e',
      border: 'rgba(217, 48, 37, 0.3)',
    },
    config: {
      bg: 'rgba(26, 115, 232, 0.14)',
      fg: '#174ea6',
      border: 'rgba(26, 115, 232, 0.35)',
    },
    scrap: {
      bg: 'rgba(95, 99, 104, 0.12)',
      fg: '#3c4043',
      border: 'rgba(95, 99, 104, 0.32)',
    },
  };
  return map[id];
}
