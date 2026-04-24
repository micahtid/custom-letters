"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Note } from "@/lib/types";
import { MessagePreview } from "@/components/message-preview";
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
        <section className="empty-state">
          <p className="eyebrow">Paper Thread</p>
          <h1>Loading note.</h1>
        </section>
      </main>
    );
  }

  if (!note) {
    return (
      <main className="simple-shell">
        <section className="empty-state">
          <p className="eyebrow">Paper Thread</p>
          <h1>Note not found.</h1>
          <Link href="/" className="ghost-link">
            Back to notes
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Note</p>
          <h1>{note.title}</h1>
        </div>
        <div className="header-actions">
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
          <Link href="/" className="ghost-link">
            Back to notes
          </Link>
        </div>
      </header>

      <section className="editor-layout">
        <div className="panel">
          <label className="field-block">
            <span className="field-label">Title</span>
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder="Untitled note"
            />
          </label>

          <label className="field-block">
            <span className="field-label">Message</span>
            <textarea
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              placeholder="Write your note here."
            />
          </label>

          <div className="header-actions">
            <button type="button" className="ghost-button" onClick={saveNote}>
              Save draft
            </button>
            <button type="button" className="primary-button" onClick={shareNote}>
              Save and create link
            </button>
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
        </div>

        <div className="panel preview-panel">
          <p className="eyebrow">Preview</p>
          <MessagePreview glyphs={profile.glyphs} message={draftMessage} />
        </div>
      </section>
    </main>
  );
}
