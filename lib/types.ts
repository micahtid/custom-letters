export type Glyph = {
  character: string;
  dataUrl: string;
  updatedAt: string;
};

export type GlyphMap = Record<string, Glyph>;

export type Profile = {
  id: string;
  createdAt: string;
  glyphs: GlyphMap;
};

export type Note = {
  id: string;
  profileId: string;
  title: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  lastSharedLetterId: string | null;
};

export type StoredLetter = {
  id: string;
  noteId: string;
  profileId: string;
  title: string;
  message: string;
  glyphs: GlyphMap;
  createdAt: string;
};

export type DataStore = {
  profiles: Record<string, Profile>;
  notes: Record<string, Note>;
  letters: Record<string, StoredLetter>;
};
