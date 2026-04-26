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

export type PaperStyle = "plain" | "lined" | "grid";

export type Attachment = {
  id: string;
  type: "image" | "sticker";
  dataUrl: string;
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  width: number; // percentage (0-100)
  rotation: number; // degrees
  borderColor: string;
  shadow: number; // 0-20 (blur radius)
  number: number;
};

export type Note = {
  id: string;
  profileId: string;
  title: string;
  message: string;
  attachments?: Attachment[];
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
  paperStyle?: PaperStyle;
  paperColor?: string;
  attachments?: Attachment[];
  createdAt: string;
};

export type DataStore = {
  profiles: Record<string, Profile>;
  notes: Record<string, Note>;
  letters: Record<string, StoredLetter>;
};
