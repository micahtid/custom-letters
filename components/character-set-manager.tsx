"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowBigLeft } from "lucide-react";
import { CHARACTERS } from "@/lib/alphabet";
import { DrawingPad } from "@/components/drawing-pad";
import { useProfile } from "@/hooks/use-profile";

type SaveState = "idle" | "saving" | "saved" | "error";

const GROUPS = [
  { label: "Uppercase", chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("") },
  { label: "Lowercase", chars: "abcdefghijklmnopqrstuvwxyz".split("") },
  { label: "Numbers", chars: "0123456789".split("") },
  { label: "Symbols", chars: [".", "?", "!", ",", "'", "\"", "-", ":", ";", "(", ")", "&"] }
];

export function CharacterSetManager() {
  const { profile, loading, setProfile } = useProfile();
  const [activeChar, setActiveChar] = useState(CHARACTERS[0]);
  const [padVersion, setPadVersion] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const completed = useMemo(() => {
    if (!profile) {
      return 0;
    }

    return CHARACTERS.filter((character) => profile.glyphs[character]).length;
  }, [profile]);

  const restartCharacterSet = async () => {
    if (!profile) {
      return;
    }

    const confirmed = window.confirm(
      "Clear all saved characters and start over? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/glyphs?profileId=${profile.id}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      setSaveState("error");
      return;
    }

    const data = (await response.json()) as { profile: typeof profile };
    setProfile(data.profile);
    setActiveChar(CHARACTERS[0]);
    setPadVersion((value) => value + 1);
    setSaveState("idle");
  };

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

      const data = (await response.json()) as { profile: typeof profile };
      setProfile(data.profile);
      setSaveState("saved");

      const nextCharacter =
        CHARACTERS.find((character) => !data.profile.glyphs[character]) ??
        activeChar;

      setActiveChar(nextCharacter);
      setPadVersion((value) => value + 1);
      window.setTimeout(() => setSaveState("idle"), 900);
    } catch {
      setSaveState("error");
    }
  };

  if (loading || !profile) {
    return (
      <main className="simple-shell">
        <div className="loader-container">
          <div className="loader" />
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell character-manager-page">
      <header className="page-header">
        <div>
          <h1>Character Set</h1>
        </div>
        <div className="header-actions">
          <span className="subtle-stat">
            {completed}/{CHARACTERS.length} saved
          </span>
          <button
            type="button"
            className="ghost-button"
            onClick={restartCharacterSet}
            disabled={completed === 0}
          >
            Restart
          </button>
          <Link href="/" className="ghost-link back-button" aria-label="Back">
            <ArrowBigLeft />
          </Link>
        </div>
      </header>

      <div className="manager-content">
        <section className="drawing-section">
          <div className="active-character-card">
            <div className="drawing-pad-container">
              <DrawingPad
                key={padVersion}
                label={activeChar}
                onSave={saveGlyph}
              />
            </div>
          </div>
        </section>

        <section className="character-grid-section">
          {GROUPS.map((group) => (
            <div key={group.label} className="group-row">
              <h3 className="group-label">{group.label}</h3>
              <div className="character-grid">
                {group.chars.map((character) => {
                  const saved = Boolean(profile.glyphs[character]);

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
                      {character}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
