import type { LucideIcon } from 'lucide-react';
import {
  Cable,
  Cpu,
  Monitor,
  Network,
  Package,
  Printer,
  ScanBarcode,
} from 'lucide-react';
import type { NoteType, NoteTypeColor, NoteTypeIcon } from './types';
import { NOTE_TYPE_COLORS } from './types';

const ICON_MAP: Record<NoteTypeIcon, LucideIcon> = {
  monitor: Monitor,
  computer: Cpu,
  printer: Printer,
  network: Network,
  scanner: ScanBarcode,
  cables: Cable,
  other: Package,
  package: Package,
};

/** Keywords → default type id (also matched against custom type names). */
const TYPE_KEYWORDS: Record<string, string[]> = {
  monitor: [
    'monitor',
    'display',
    'screen',
    'lcd',
    'led',
    'ultrasharp',
    'dell u',
    'hp e2',
    'viewsonic',
  ],
  computer: [
    'computer',
    'laptop',
    'desktop',
    'pc',
    'notebook',
    'thinkpad',
    'macbook',
    'optiplex',
    'elitebook',
    'probook',
    'latitude',
  ],
  printer: [
    'printer',
    'laserjet',
    'inkjet',
    'mfp',
    'multifunction',
    'xerox',
    'brother',
    'epson',
  ],
  network: [
    'network',
    'switch',
    'router',
    'access point',
    'ap ',
    'nic',
    'ethernet',
    'wifi',
    'wi-fi',
    'cisco',
    'unifi',
  ],
  scanner: ['scanner', 'scanjet', 'document scanner', 'flatbed'],
  cables: [
    'cable',
    'cables',
    'hdmi',
    'displayport',
    'usb-c',
    'usbc',
    'power cord',
    'adapter cable',
  ],
};

export function noteTypeIcon(icon: NoteTypeIcon | undefined | null): LucideIcon {
  return ICON_MAP[icon ?? 'package'] ?? Package;
}

export function noteTypeById(
  types: NoteType[],
  id: string | null | undefined,
): NoteType | null {
  if (!id) return null;
  return types.find((t) => t.id === id) ?? null;
}

export function noteTypeLabel(
  types: NoteType[],
  id: string | null | undefined,
): string | null {
  return noteTypeById(types, id)?.name ?? null;
}

export function nextNoteTypeColor(existing: NoteType[]): NoteTypeColor {
  const used = new Set(existing.map((t) => t.color));
  return (
    NOTE_TYPE_COLORS.find((c) => !used.has(c)) ??
    NOTE_TYPE_COLORS[existing.length % NOTE_TYPE_COLORS.length]
  );
}

export function guessIconFromName(name: string): NoteTypeIcon {
  const lower = name.trim().toLowerCase();
  for (const [id, keywords] of Object.entries(TYPE_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k)) || lower === id) {
      return id as NoteTypeIcon;
    }
  }
  if (lower.includes('other')) return 'other';
  return 'package';
}

/**
 * Suggest a type from title/description text.
 * Prefers matching an existing type by keywords or name; never invents one.
 */
export function suggestNoteType(
  types: NoteType[],
  title: string,
  description = '',
): NoteType | null {
  if (types.length === 0) return null;
  const haystack = `${title}\n${description}`.toLowerCase();
  if (!haystack.trim()) return null;

  // Score default keyword packs against current types (by id or name).
  let best: { type: NoteType; score: number } | null = null;

  for (const type of types) {
    let score = 0;
    const name = type.name.toLowerCase();
    if (name.length >= 3 && haystack.includes(name)) score += 3;

    const keywords =
      TYPE_KEYWORDS[type.id] ??
      TYPE_KEYWORDS[type.icon] ??
      (name ? [name] : []);

    for (const keyword of keywords) {
      if (keyword.length >= 2 && haystack.includes(keyword)) {
        score += keyword.length >= 5 ? 2 : 1;
      }
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { type, score };
    }
  }

  return best?.type ?? null;
}

export function typeColorVars(color: NoteTypeColor): {
  bg: string;
  fg: string;
  border: string;
} {
  const map: Record<NoteTypeColor, { bg: string; fg: string; border: string }> =
    {
      blue: {
        bg: 'rgba(26, 115, 232, 0.14)',
        fg: '#174ea6',
        border: 'rgba(26, 115, 232, 0.35)',
      },
      teal: {
        bg: 'rgba(0, 151, 167, 0.14)',
        fg: '#00796b',
        border: 'rgba(0, 151, 167, 0.35)',
      },
      green: {
        bg: 'rgba(30, 142, 62, 0.14)',
        fg: '#0d652d',
        border: 'rgba(30, 142, 62, 0.35)',
      },
      amber: {
        bg: 'rgba(242, 153, 0, 0.16)',
        fg: '#b06000',
        border: 'rgba(242, 153, 0, 0.4)',
      },
      orange: {
        bg: 'rgba(227, 116, 0, 0.14)',
        fg: '#b06000',
        border: 'rgba(227, 116, 0, 0.35)',
      },
      rose: {
        bg: 'rgba(217, 48, 37, 0.12)',
        fg: '#a50e0e',
        border: 'rgba(217, 48, 37, 0.3)',
      },
      violet: {
        bg: 'rgba(103, 58, 183, 0.12)',
        fg: '#4527a0',
        border: 'rgba(103, 58, 183, 0.32)',
      },
      slate: {
        bg: 'rgba(95, 99, 104, 0.12)',
        fg: '#3c4043',
        border: 'rgba(95, 99, 104, 0.3)',
      },
    };
  return map[color];
}
