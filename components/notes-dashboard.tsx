"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Paper Thread</p>
          <h1>Your notes</h1>
          <p className="muted-copy">
            Open a draft, keep writing, or make a new note.
          </p>
        </div>
        <div className="header-actions">
          <Link href="/characters" className="ghost-link">
            Edit character set
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

      <section className="notes-grid">
        <div className="panel compact-panel">
          <p className="eyebrow">Character set</p>
          <h2>{Object.keys(profile.glyphs).length} saved characters</h2>
          <p className="muted-copy">
            Your notes will use your current saved handwriting whenever you
            create a share link.
          </p>
        </div>

        {loading ? (
          <div className="panel empty-panel">
            <p>Loading notes.</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="panel empty-panel">
            <h2>No notes yet.</h2>
            <p className="muted-copy">
              Start one and it will stay here while you keep working on it.
            </p>
          </div>
        ) : (
          notes.map((note) => {
            return (
              <article key={note.id} className="panel note-card">
                <div className="panel-row">
                  <div>
                    <p className="eyebrow">Updated</p>
                    <h2>{note.title}</h2>
                  </div>
                  <span className="timestamp">
                    {new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric"
                    }).format(new Date(note.updatedAt))}
                  </span>
                </div>

                <p className="note-snippet">
                  {note.message.trim() || "No message yet."}
                </p>

                <div className="panel-row">
                  <Link href={`/notes/${note.id}`} className="ghost-link">
                    Open
                  </Link>
                  {note.lastSharedLetterId ? (
                    <Link href={`/l/${note.lastSharedLetterId}`} className="text-link">
                      Last shared note
                    </Link>
                  ) : (
                    <span className="timestamp">Not shared yet</span>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
