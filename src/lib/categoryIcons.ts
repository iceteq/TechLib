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
import type { NoteCategory } from './types';

export function categoryIcon(
  category: NoteCategory | undefined | null,
): LucideIcon {
  switch (category) {
    case 'monitor':
      return Monitor;
    case 'computer':
      return Cpu;
    case 'printer':
      return Printer;
    case 'network':
      return Network;
    case 'scanner':
      return ScanBarcode;
    case 'cables':
      return Cable;
    default:
      return Package;
  }
}
