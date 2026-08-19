export type NoteBackground =
  | 'default'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'pink'
  | 'gray';

export interface NoteImage {
  id: string;
  position: number;
}

export interface NoteImageWithUrl extends NoteImage {
  url: string;
}

export interface Note {
  id: string;
  title: string;
  description: string;
  background: NoteBackground;
  createdAt: number;
  updatedAt: number;
  labelIds: string[];
  images: NoteImage[];
}

export interface NoteWithUrls extends Omit<Note, 'images'> {
  images: NoteImageWithUrl[];
}

export interface Label {
  id: string;
  name: string;
}
