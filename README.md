# Penned

Penned turns your handwriting into a font so you can write letters that look handwritten and share them with a link.

## What it does

You draw each letter of the alphabet once to build your own set of handwriting glyphs. You then write a note, and Penned renders it in your handwriting. You can pick a paper style and color and add images, stickers, or drawings on top. Publishing a note gives you a link. Anyone who opens that link sees an envelope, then your letter.

## Architecture

Penned is a Next.js App Router app with a Convex backend.

The frontend in `app/` and `components/` renders the editor, the publish view, and the public letter. Handwriting is drawn on a canvas and saved as image data.

The backend in `convex/` holds the data and the server functions across four tables:

- `glyphs`: one handwriting image per character, per user.
- `notes`: a working draft with a title, message, and attachments.
- `letters`: a published snapshot of a note that a public link points to.
- `letterGlyphs`: a copy of the glyphs used by each letter, so a shared link keeps rendering the same handwriting even after the user edits their glyphs.

Sign-in uses Google through Convex Auth. The home page and public letter links are open, and everything else requires an account.
