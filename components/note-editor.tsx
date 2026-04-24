"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowBigLeft } from "lucide-react";
import type { Note } from "@/lib/types";
import { GlyphEditor } from "@/components/glyph-editor";
import { useProfile } from "@/hooks/use-profile";

type NoteEditorProps = {
  noteId: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function NoteEditor({ noteId }: NoteEditorProps) {
  const { profile, loading } = useProfile();
  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [noteLoading, setNoteLoading] = useState(true);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (!profile) {
      return;
    }

    void (async () => {
      const response = await fetch(
        `/api/notes/${noteId}?profileId=${profile.id}`
      );

      if (!response.ok) {
        setNote(null);
        setNoteLoading(false);
        return;
      }

      const data = (await response.json()) as { note: Note };
      setNote(data.note);
      setDraftTitle(data.note.title);
      setDraftMessage(data.note.message);

      if (data.note.lastSharedLetterId) {
        setShareUrl(`${window.location.origin}/l/${data.note.lastSharedLetterId}`);
      }

      setNoteLoading(false);
    })();
  }, [noteId, profile]);

  useEffect(() => {
    if (!loading && profile && Object.keys(profile.glyphs).length === 0) {
      router.replace("/characters");
    }
  }, [loading, profile, router]);

  const dirty = useMemo(() => {
    if (!note) {
      return false;
    }

    return note.title !== draftTitle || note.message !== draftMessage;
  }, [draftMessage, draftTitle, note]);

  const saveNote = async () => {
    if (!profile || !note) {
      return null;
    }

    setSaveState("saving");

    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: profile.id,
          title: draftTitle,
          message: draftMessage
        })
      });

      if (!response.ok) {
        throw new Error("Unable to save note.");
      }

      const data = (await response.json()) as { note: Note };
      setNote(data.note);
      setDraftTitle(data.note.title);
      setDraftMessage(data.note.message);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1000);
      return data.note;
    } catch {
      setSaveState("error");
      return null;
    }
  };

  const shareNote = async () => {
    if (!profile || !note) {
      return;
    }

    const latestNote = dirty ? await saveNote() : note;

    if (!latestNote) {
      return;
    }

    const response = await fetch(`/api/notes/${latestNote.id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: profile.id })
    });

    if (!response.ok) {
      setSaveState("error");
      return;
    }

    const data = (await response.json()) as {
      note: Note;
      letter: { id: string };
    };
    setNote(data.note);
    setShareUrl(`${window.location.origin}/l/${data.letter.id}`);
  };

  if (loading || !profile || noteLoading) {
    return (
      <main className="simple-shell">
        <div className="loader-container">
          <div className="loader" />
        </div>
      </main>
    );
  }

  if (!note) {
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

  return (
    <main className="page-shell note-editor-page">
      <header className="page-header">
        <div className="title-area" data-value={draftTitle || "Untitled note"}>
          <input
            className="title-input-minimal"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="Untitled note"
          />
          <span className={`status-pill status-${saveState}`}>
            {saveState === "idle"
              ? dirty
                ? "Unsaved"
                : "Saved"
              : saveState === "saving"
                ? "Saving"
                : saveState === "saved"
                  ? "Saved"
                  : "Retry"}
          </span>
        </div>
        <div className="header-actions">
          <button type="button" className="ghost-button" onClick={saveNote}>
            Save
          </button>
          <button type="button" className="primary-button" onClick={shareNote}>
            Create Link
          </button>
          <Link href="/" className="ghost-link back-button" aria-label="Back">
            <ArrowBigLeft />
          </Link>
        </div>
      </header>

      <section className="direct-editor-container">
        <div className="paper-editor-wrapper">
          <GlyphEditor
            glyphs={profile.glyphs}
            value={draftMessage}
            onChange={setDraftMessage}
            placeholder="Write your note here..."
          />
        </div>

        {shareUrl ? (
          <div className="share-card">
            <span className="field-label">Share link</span>
            <div className="share-row">
              <input readOnly value={shareUrl} />
              <button
                type="button"
                className="ghost-button"
                onClick={() => navigator.clipboard.writeText(shareUrl)}
              >
                Copy
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
