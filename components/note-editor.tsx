"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowBigLeft } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { GlyphMap, NoteId } from "@/lib/types";
import { GlyphEditor } from "@/components/glyph-editor";

type NoteEditorProps = {
  noteId: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function NoteEditor({ noteId }: NoteEditorProps) {
  const router = useRouter();
  const note = useQuery(api.notes.get, { id: noteId as NoteId });
  const glyphs = useQuery(api.glyphs.list);
  const updateNote = useMutation(api.notes.update);

  const [draftTitle, setDraftTitle] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (note === undefined) return;
    if (note === null) return;

    if (note.lastSharedLetterId) {
      router.replace("/");
      return;
    }

    if (!hydrated) {
      setDraftTitle(note.title);
      setDraftMessage(note.message);
      setHydrated(true);
    }
  }, [note, hydrated, router]);

  const dirty = useMemo(() => {
    if (!note) return false;
    return note.title !== draftTitle || note.message !== draftMessage;
  }, [draftMessage, draftTitle, note]);

  const glyphMap: GlyphMap = useMemo(() => {
    const map: GlyphMap = {};
    for (const g of glyphs ?? []) {
      map[g.character] = {
        character: g.character,
        dataUrl: g.dataUrl,
        updatedAt: g.updatedAt
      };
    }
    return map;
  }, [glyphs]);

  const saveNote = async () => {
    if (!note) return;
    setSaveState("saving");
    try {
      await updateNote({
        id: note._id,
        title: draftTitle,
        message: draftMessage
      });
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1000);
    } catch {
      setSaveState("error");
    }
  };

  if (note === undefined || glyphs === undefined) {
    return (
      <main className="simple-shell">
        <div className="loader-container">
          <div className="loader" />
        </div>
      </main>
    );
  }

  if (note === null) {
    return (
      <main className="simple-shell">
        <section className="empty-state">
          <h1>Note not found.</h1>
          <Link href="/" className="ghost-link back-button" aria-label="Back">
            <ArrowBigLeft />
          </Link>
        </section>
      </main>
    );
  }

  const isLive = Boolean(note.lastSharedLetterId);

  return (
    <main className="page-shell note-editor-page">
      <header className="page-header">
        <div className="title-area" data-value={draftTitle || "Untitled note"}>
          <input
            className="title-input-minimal"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="Untitled note"
            disabled={isLive}
          />
        </div>
        <div className="header-actions">
          {isLive ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => router.push(`/notes/${note._id}/publish`)}
            >
              Manage
            </button>
          ) : (
            <>
              <button
                type="button"
                className="ghost-button"
                onClick={saveNote}
                disabled={!dirty || saveState === "saving"}
              >
                {saveState === "saving" ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => router.push(`/notes/${note._id}/publish`)}
              >
                Publish
              </button>
            </>
          )}
          <Link href="/" className="ghost-link back-button" aria-label="Back">
            <ArrowBigLeft />
          </Link>
        </div>
      </header>

      <section
        className={`direct-editor-container${isLive ? " is-locked" : ""}`}
        aria-disabled={isLive || undefined}
      >
        <div className="paper-editor-wrapper">
          <GlyphEditor
            glyphs={glyphMap}
            value={draftMessage}
            onChange={setDraftMessage}
            placeholder="Write your note here..."
          />
        </div>
      </section>
    </main>
  );
}
