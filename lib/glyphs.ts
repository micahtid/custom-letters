import type { GlyphMap } from "@/lib/types";

type GlyphSource = { character: string; dataUrl: string; updatedAt: number };

// Turn the flat list of saved glyphs into a map keyed by character. The editor
// and the publish view both render text this way, so they share this helper.
export function buildGlyphMap(glyphs: GlyphSource[] | undefined): GlyphMap {
  const map: GlyphMap = {};
  for (const glyph of glyphs ?? []) {
    map[glyph.character] = {
      character: glyph.character,
      dataUrl: glyph.dataUrl,
      updatedAt: glyph.updatedAt
    };
  }
  return map;
}
