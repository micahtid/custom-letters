import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

const attachment = v.object({
  id: v.string(),
  type: v.union(v.literal("image"), v.literal("sticker")),
  dataUrl: v.string(),
  x: v.number(),
  y: v.number(),
  width: v.number(),
  rotation: v.number(),
  borderColor: v.string(),
  shadow: v.number(),
  number: v.number()
});

// Delete a published letter along with its glyph snapshots. Taking a letter
// down means removing both, so this keeps the three call sites in sync.
async function deleteLetterWithSnapshots(
  ctx: MutationCtx,
  letterId: Id<"letters">
) {
  const snapshots = await ctx.db
    .query("letterGlyphs")
    .withIndex("by_letter", (q) => q.eq("letterId", letterId))
    .collect();
  for (const snapshot of snapshots) {
    await ctx.db.delete(snapshot._id);
  }
  await ctx.db.delete(letterId);
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return notes.sort((a, b) => b.updatedAt - a.updatedAt);
  }
});

export const get = query({
  args: { id: v.id("notes") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const note = await ctx.db.get(id);
    if (!note || note.userId !== userId) return null;
    return note;
  }
});

// A user may keep at most this many notes at once; they must take one
// down before starting another.
export const MAX_NOTES_PER_USER = 10;

export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");

    const existing = await ctx.db
      .query("notes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (existing.length >= MAX_NOTES_PER_USER) {
      throw new Error(
        `You can keep up to ${MAX_NOTES_PER_USER} notes at a time. Take one down before making another.`
      );
    }

    const now = Date.now();
    return await ctx.db.insert("notes", {
      userId,
      title: "Untitled note",
      message: "",
      lastSharedLetterId: null,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const update = mutation({
  args: {
    id: v.id("notes"),
    title: v.string(),
    message: v.string()
  },
  handler: async (ctx, { id, title, message }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");

    const note = await ctx.db.get(id);
    if (!note || note.userId !== userId) throw new Error("Note not found.");

    // Editing a note takes down its published letter. We allow only one
    // link per letter, and that link must reflect the latest content.
    if (note.lastSharedLetterId) {
      await deleteLetterWithSnapshots(ctx, note.lastSharedLetterId);
    }

    await ctx.db.patch(id, {
      title: title.trim() || "Untitled note",
      message,
      lastSharedLetterId: null,
      updatedAt: Date.now()
    });
  }
});

export const remove = mutation({
  args: { id: v.id("notes") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");

    const note = await ctx.db.get(id);
    if (!note || note.userId !== userId) throw new Error("Note not found.");

    if (note.lastSharedLetterId) {
      await deleteLetterWithSnapshots(ctx, note.lastSharedLetterId);
    }

    await ctx.db.delete(id);
  }
});

export const share = mutation({
  args: {
    id: v.id("notes"),
    paperStyle: v.union(v.literal("plain"), v.literal("lined"), v.literal("grid")),
    paperColor: v.string(),
    attachments: v.optional(v.array(attachment))
  },
  handler: async (ctx, { id, paperStyle, paperColor, attachments }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");

    const note = await ctx.db.get(id);
    if (!note || note.userId !== userId) throw new Error("Note not found.");

    // Reuse the existing letter id when republishing so the public URL stays
    // stable. Content edits go through `update`, which clears the letter
    // first, so by the time we get here the letter only differs in its
    // publish settings.
    const previousLetterId = note.lastSharedLetterId;
    const previousLetter = previousLetterId
      ? await ctx.db.get(previousLetterId)
      : null;

    let letterId = previousLetterId;
    if (letterId && previousLetter) {
      await ctx.db.patch(letterId, {
        title: note.title,
        message: note.message,
        paperStyle,
        paperColor,
        attachments: attachments ?? []
      });
    } else {
      letterId = await ctx.db.insert("letters", {
        noteId: id,
        userId,
        title: note.title,
        message: note.message,
        paperStyle,
        paperColor,
        attachments: attachments ?? [],
        createdAt: Date.now()
      });
    }

    // Snapshot the current glyph set onto the letter so the public link
    // keeps rendering the user's handwriting as it was at publish time.
    const oldSnapshots = await ctx.db
      .query("letterGlyphs")
      .withIndex("by_letter", (q) => q.eq("letterId", letterId!))
      .collect();
    for (const s of oldSnapshots) await ctx.db.delete(s._id);

    const userGlyphs = await ctx.db
      .query("glyphs")
      .withIndex("by_user_character", (q) => q.eq("userId", userId))
      .collect();
    for (const g of userGlyphs) {
      await ctx.db.insert("letterGlyphs", {
        letterId: letterId!,
        character: g.character,
        dataUrl: g.dataUrl
      });
    }

    await ctx.db.patch(id, {
      lastSharedLetterId: letterId,
      updatedAt: Date.now()
    });

    return letterId;
  }
});

export const unshare = mutation({
  args: { id: v.id("notes") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");

    const note = await ctx.db.get(id);
    if (!note || note.userId !== userId) throw new Error("Note not found.");

    if (note.lastSharedLetterId) {
      await deleteLetterWithSnapshots(ctx, note.lastSharedLetterId);
      await ctx.db.patch(id, {
        lastSharedLetterId: null,
        updatedAt: Date.now()
      });
    }
  }
});
