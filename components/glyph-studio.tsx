"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CHARACTERS } from "@/lib/alphabet";
import type { Profile } from "@/lib/types";
import { DrawingPad } from "./drawing-pad";
import { MessagePreview } from "./message-preview";

type SaveState = "idle" | "saving" | "saved" | "error";

export function GlyphStudio() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeChar, setActiveChar] = useState(CHARACTERS[0]);
  const [message, setMessage] = useState("Dear you,\n");
  const [padVersion, setPadVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    void (async () => {
      const existingId = window.localStorage.getItem("paper-thread-profile");
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(existingId ? { id: existingId } : {})
      });
      const data = (await response.json()) as { profile: Profile };
      window.localStorage.setItem("paper-thread-profile", data.profile.id);
      setProfile(data.profile);
      setLoading(false);
    })();
  }, []);

  const completed = useMemo(() => {
    if (!profile) {
      return 0;
    }

    return CHARACTERS.filter((character) => profile.glyphs[character]).length;
  }, [profile]);

  const activePreview = profile?.glyphs[activeChar]?.dataUrl ?? null;

  const saveGlyph = async (dataUrl: string) => {
    if (!profile) {
      return;
    }

    setSaveState("saving");

    try {
      const response = await fetch("/api/glyphs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: profile.id,
          character: activeChar,
          dataUrl
        })
      });

      if (!response.ok) {
        throw new Error("Unable to save glyph.");
      }

      const data = (await response.json()) as { profile: Profile };
      setProfile(data.profile);
      setSaveState("saved");

      const nextCharacter =
        CHARACTERS.find((character) => !data.profile.glyphs[character]) ??
        CHARACTERS[(CHARACTERS.indexOf(activeChar) + 1) % CHARACTERS.length];

      setActiveChar(nextCharacter);
      setPadVersion((value) => value + 1);
      window.setTimeout(() => setSaveState("idle"), 900);
    } catch {
      setSaveState("error");
    }
  };

  const handleCreateLetter = async () => {
    if (!profile) {
      return;
    }

    const response = await fetch("/api/letters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: profile.id,
        message
      })
    });

    const data = (await response.json()) as { letter: { id: string } };
    const url = `${window.location.origin}/l/${data.letter.id}`;
    setShareUrl(url);
  };

  return (
    <main className="studio-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Paper Thread</p>
          <h1>Write once. Send in your own hand.</h1>
          <p className="lede">
            Capture your alphabet and numbers, then type a note that assembles
            itself from your saved handwriting.
          </p>
        </div>
        <div className="hero-stats">
          <div className="stat-card">
            <span>Glyphs saved</span>
            <strong>
              {completed}/{CHARACTERS.length}
            </strong>
          </div>
          <div className="stat-card">
            <span>Current character</span>
            <strong>{activeChar}</strong>
          </div>
        </div>
      </section>

      <section className="workspace-grid">
        <div className="capture-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Step 1</p>
              <h2>Build your character set</h2>
            </div>
            <span className={`status-pill status-${saveState}`}>
              {loading
                ? "Loading..."
                : saveState === "idle"
                  ? "Ready"
                  : saveState === "saving"
                    ? "Saving..."
                    : saveState === "saved"
                      ? "Saved"
                      : "Retry"}
            </span>
          </div>

          <div className="capture-card">
            <div className="capture-meta">
              <div>
                <span className="active-label">Draw this character</span>
                <div className="active-character">{activeChar}</div>
              </div>
              <div className="saved-preview">
                {activePreview ? (
                  <Image
                    src={activePreview}
                    alt={`Saved ${activeChar}`}
                    width={116}
                    height={116}
                    unoptimized
                  />
                ) : (
                  <span>Not saved yet</span>
                )}
              </div>
            </div>

            <DrawingPad
              key={padVersion}
              label={activeChar}
              onSave={saveGlyph}
            />
          </div>

          <div className="character-grid" aria-label="Character picker">
            {CHARACTERS.map((character) => {
              const saved = Boolean(profile?.glyphs[character]);

              return (
                <button
                  key={character}
                  type="button"
                  className={`character-chip ${
                    character === activeChar ? "active" : ""
                  } ${saved ? "saved" : ""}`}
                  onClick={() => {
                    setActiveChar(character);
                    setPadVersion((value) => value + 1);
                  }}
                >
                  <span>{character}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="compose-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Step 2</p>
              <h2>Type your letter</h2>
            </div>
          </div>

          <label className="composer-field">
            <span>Message</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Write something worth opening slowly."
            />
          </label>

          <div className="preview-frame">
            <div className="preview-head">
              <p className="eyebrow">Live preview</p>
              <button type="button" className="primary-button" onClick={handleCreateLetter}>
                Save and create link
              </button>
            </div>
            <MessagePreview glyphs={profile?.glyphs ?? {}} message={message} />
          </div>

          {shareUrl ? (
            <div className="share-card">
              <span>Shareable link</span>
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
      </section>
    </main>
  );
}
