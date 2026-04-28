"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Eraser, X } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { CHARACTERS } from "@/lib/alphabet";
import { api } from "@/convex/_generated/api";
import type { Note, NoteId } from "@/lib/types";

export function NotesDashboard() {
  const router = useRouter();
  const notes = useQuery(api.notes.list);
  const glyphs = useQuery(api.glyphs.list);
  const createNote = useMutation(api.notes.create);
  const deleteNote = useMutation(api.notes.remove);
  const unshareNote = useMutation(api.notes.unshare);
  const { signOut } = useAuthActions();

  const [creating, setCreating] = useState(false);
  const [managingNoteId, setManagingNoteId] = useState<NoteId | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isTakingDown, setIsTakingDown] = useState(false);
  const [copiedCardId, setCopiedCardId] = useState<NoteId | null>(null);

  const loading = notes === undefined || glyphs === undefined;
  const glyphCount = glyphs?.length ?? 0;

  const managingNote = managingNoteId
    ? notes?.find((n) => n._id === managingNoteId) ?? null
    : null;

  useEffect(() => {
    if (!managingNote) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", handleKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [managingNote]);

  const closeModal = () => {
    setManagingNoteId(null);
    setLinkCopied(false);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const id = await createNote();
      router.push(`/notes/${id}`);
    } catch {
      setCreating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!managingNote?.lastSharedLetterId) return;
    const url = `${window.location.origin}/l/${managingNote.lastSharedLetterId}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1500);
  };

  const handleCopyCardLink = async (note: Note) => {
    if (!note.lastSharedLetterId) return;
    const url = `${window.location.origin}/l/${note.lastSharedLetterId}`;
    await navigator.clipboard.writeText(url);
    setCopiedCardId(note._id);
    window.setTimeout(() => {
      setCopiedCardId((current) => (current === note._id ? null : current));
    }, 1500);
  };

  const handleDelete = async (note: Note) => {
    const confirmed = window.confirm(
      `Delete "${note.title}"? This cannot be undone.${
        note.lastSharedLetterId ? " The published link will also stop working." : ""
      }`
    );
    if (!confirmed) return;
    await deleteNote({ id: note._id });
  };

  const handleTakeDown = async () => {
    if (!managingNote) return;
    setIsTakingDown(true);
    try {
      await unshareNote({ id: managingNote._id });
      closeModal();
    } catch (err) {
      console.error(err);
    } finally {
      setIsTakingDown(false);
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
            Edit Character Set ({glyphCount}/{CHARACTERS.length})
          </Link>
          <button
            type="button"
            className="ghost-button"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
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
      ) : notes!.length === 0 ? (
        <div className="empty-dashboard">
          <h2>No notes yet.</h2>
          <p className="muted-copy">
            Start one and it will stay here while you keep working on it.
          </p>
        </div>
      ) : (
        <section className="notes-grid">
          {notes!.map((note) => {
            const isLive = Boolean(note.lastSharedLetterId);
            return (
              <article key={note._id} className="panel note-card">
                <div className="note-card-body">
                  <div className="note-card-heading">
                    <h2>{note.title}</h2>
                    <span
                      className={`status-badge ${isLive ? "status-badge--live" : "status-badge--draft"}`}
                    >
                      {isLive ? "Live" : "Draft"}
                    </span>
                  </div>
                  <p className="note-snippet">
                    {note.message.trim() || "No message yet."}
                  </p>
                </div>

                <div className="panel-row" style={{ justifyContent: "space-between", marginTop: "auto" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {isLive ? (
                      <button
                        type="button"
                        className="ghost-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          setManagingNoteId(note._id);
                        }}
                      >
                        Edit
                      </button>
                    ) : (
                      <Link
                        href={`/notes/${note._id}`}
                        className="ghost-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Edit
                      </Link>
                    )}
                    {isLive && (
                      <button
                        type="button"
                        className="icon-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleCopyCardLink(note);
                        }}
                        aria-label={
                          copiedCardId === note._id
                            ? "Link copied"
                            : `Copy link for ${note.title}`
                        }
                      >
                        {copiedCardId === note._id ? (
                          <Check size={16} />
                        ) : (
                          <Copy size={16} />
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      className="icon-button icon-button--danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(note);
                      }}
                      aria-label={`Delete ${note.title}`}
                    >
                      <Eraser size={16} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
      {managingNote && managingNote.lastSharedLetterId && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Manage published letter"
          onClick={closeModal}
        >
          <div
            className="manage-link-card modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={closeModal}
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="manage-link-info">
              <h2 className="manage-link-title">{managingNote.title}</h2>
              <p className="manage-link-explanation">
                This letter is published. To make changes, take it down first—the
                link will stop working, and you can edit and republish from the editor.
              </p>
            </div>

            <div className="manage-link-url">
              <div className="share-row">
                <input
                  id="manage-link-input"
                  readOnly
                  value={`${window.location.origin}/l/${managingNote.lastSharedLetterId}`}
                />
                <button
                  type="button"
                  className="ghost-button manage-link-copy"
                  onClick={handleCopyLink}
                  aria-label={linkCopied ? "Link copied" : "Copy link"}
                >
                  {linkCopied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <button
              type="button"
              className="danger-button full-width"
              onClick={handleTakeDown}
              disabled={isTakingDown}
            >
              {isTakingDown ? "Taking down..." : "Take Down"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
