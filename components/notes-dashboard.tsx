"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CHARACTERS } from "@/lib/alphabet";
import type { Note, Profile } from "@/lib/types";

type NotesDashboardProps = {
  profile: Profile;
};

export function NotesDashboard({ profile }: NotesDashboardProps) {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/notes?profileId=${profile.id}`);
      const data = (await response.json()) as { notes: Note[] };
      setNotes(data.notes);
      setLoading(false);
    })();
  }, [profile.id]);

  const handleCreate = async () => {
    setCreating(true);
    const response = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: profile.id })
    });
    const data = (await response.json()) as { note: Note };
    router.push(`/notes/${data.note.id}`);
  };

  const handleShare = async (noteId: string) => {
    const response = await fetch(`/api/notes/${noteId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: profile.id })
    });

    if (response.ok) {
      const data = (await response.json()) as { note: Note };
      setNotes((prev) =>
        prev.map((n) => (n.id === data.note.id ? data.note : n))
      );
    }
  };

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <h1>Your Notes</h1>
          <p className="muted-copy">
            Open a draft, keep writing, or make a new note.
          </p>
        </div>
        <div className="header-actions">
          <Link href="/characters" className="ghost-link">
            Edit Character Set ({Object.keys(profile.glyphs).length}/
            {CHARACTERS.length})
          </Link>
          <button
            type="button"
            className="primary-button"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? "Creating..." : "New note"}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="loader-container">
          <div className="loader" />
        </div>
      ) : notes.length === 0 ? (
        <div className="empty-dashboard">
          <h2>No notes yet.</h2>
          <p className="muted-copy">
            Start one and it will stay here while you keep working on it.
          </p>
        </div>
      ) : (
        <section className="notes-grid">
          {notes.map((note) => {
            return (
              <article key={note.id} className="panel note-card">
                <div className="note-card-body">
                  <p className="note-date">
                    Last Edited{" "}
                    {new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric"
                    }).format(new Date(note.updatedAt))}
                  </p>
                  <h2>{note.title}</h2>
                  <p className="note-snippet">
                    {note.message.trim() || "No message yet."}
                  </p>
                </div>

                <div className="panel-row" style={{ justifyContent: "space-between", marginTop: "auto" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Link 
                      href={`/notes/${note.id}`} 
                      className="ghost-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleShare(note.id);
                      }}
                    >
                      Share
                    </button>
                  </div>
                  {note.lastSharedLetterId ? (
                    <Link 
                      href={`/l/${note.lastSharedLetterId}`} 
                      className="text-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Last shared note
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
