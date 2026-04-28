import { query } from "./_generated/server";
import { v } from "convex/values";

export const getPublic = query({
  args: { id: v.id("letters") },
  handler: async (ctx, { id }) => {
    const letter = await ctx.db.get(id);
    if (!letter) return null;

    const snapshots = await ctx.db
      .query("letterGlyphs")
      .withIndex("by_letter", (q) => q.eq("letterId", id))
      .collect();

    const glyphs: Record<
      string,
      { character: string; dataUrl: string; updatedAt: number }
    > = {};
    for (const s of snapshots) {
      glyphs[s.character] = {
        character: s.character,
        dataUrl: s.dataUrl,
        updatedAt: s._creationTime
      };
    }

    return {
      id: letter._id,
      noteId: letter.noteId,
      title: letter.title,
      message: letter.message,
      paperStyle: letter.paperStyle,
      paperColor: letter.paperColor,
      attachments: letter.attachments ?? [],
      glyphs,
      createdAt: new Date(letter.createdAt).toISOString()
    };
  }
});
