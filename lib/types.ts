import type { Doc, Id } from "@/convex/_generated/dataModel";

export type Glyph = {
  character: string;
  dataUrl: string;
  updatedAt: number;
};

export type GlyphMap = Record<string, Glyph>;

export type PaperStyle = "plain" | "lined" | "grid";

export type Attachment = {
  id: string;
  type: "image" | "sticker";
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  rotation: number;
  borderColor: string;
  shadow: number;
  number: number;
};

export type Note = Doc<"notes">;
export type NoteId = Id<"notes">;
export type LetterId = Id<"letters">;

// Shape returned by `convex/letters.getPublic` — the public letter view
// reads this, no auth required.
export type PublicLetter = {
  id: LetterId;
  noteId: NoteId;
  title: string;
  message: string;
  paperStyle: PaperStyle;
  paperColor: string;
  attachments: Attachment[];
  glyphs: GlyphMap;
  createdAt: string;
};
