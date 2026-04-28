import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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

export default defineSchema({
  ...authTables,

  glyphs: defineTable({
    userId: v.id("users"),
    character: v.string(),
    dataUrl: v.string(),
    updatedAt: v.number()
  }).index("by_user_character", ["userId", "character"]),

  notes: defineTable({
    userId: v.id("users"),
    title: v.string(),
    message: v.string(),
    attachments: v.optional(v.array(attachment)),
    lastSharedLetterId: v.union(v.id("letters"), v.null()),
    createdAt: v.number(),
    updatedAt: v.number()
  }).index("by_user", ["userId"]),

  letters: defineTable({
    noteId: v.id("notes"),
    userId: v.id("users"),
    title: v.string(),
    message: v.string(),
    paperStyle: v.union(v.literal("plain"), v.literal("lined"), v.literal("grid")),
    paperColor: v.string(),
    attachments: v.optional(v.array(attachment)),
    createdAt: v.number()
  }).index("by_note", ["noteId"]),

  // Per-letter glyph snapshots — split out of `letters` so each document
  // stays comfortably under the 1MB Convex doc limit.
  letterGlyphs: defineTable({
    letterId: v.id("letters"),
    character: v.string(),
    dataUrl: v.string()
  }).index("by_letter", ["letterId"])
});
