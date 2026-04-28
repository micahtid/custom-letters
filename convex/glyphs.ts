import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("glyphs")
      .withIndex("by_user_character", (q) => q.eq("userId", userId))
      .collect();
  }
});

export const save = mutation({
  args: {
    character: v.string(),
    dataUrl: v.string()
  },
  handler: async (ctx, { character, dataUrl }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");

    const existing = await ctx.db
      .query("glyphs")
      .withIndex("by_user_character", (q) =>
        q.eq("userId", userId).eq("character", character)
      )
      .unique();

    const updatedAt = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, { dataUrl, updatedAt });
      return existing._id;
    }

    return await ctx.db.insert("glyphs", {
      userId,
      character,
      dataUrl,
      updatedAt
    });
  }
});

export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");

    const all = await ctx.db
      .query("glyphs")
      .withIndex("by_user_character", (q) => q.eq("userId", userId))
      .collect();

    for (const glyph of all) {
      await ctx.db.delete(glyph._id);
    }
  }
});
