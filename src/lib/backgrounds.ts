import type { NoteBackground } from './types';

export interface BackgroundOption {
  id: NoteBackground;
  label: string;
  surface: string;
  border: string;
}

export const BACKGROUNDS: BackgroundOption[] = [
  { id: 'default', label: 'Default', surface: '#ffffff', border: '#e6e8ec' },
  { id: 'yellow', label: 'Yellow', surface: '#fff8c5', border: '#f0e08a' },
  { id: 'green', label: 'Green', surface: '#e4f6d8', border: '#b9df9c' },
  { id: 'blue', label: 'Blue', surface: '#d9ebff', border: '#a8c8ef' },
  { id: 'pink', label: 'Pink', surface: '#fde4ef', border: '#efb7cf' },
  { id: 'gray', label: 'Gray', surface: '#e9eaee', border: '#c9ccd4' },
];

export function getBackground(id: NoteBackground): BackgroundOption {
  return BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
}
