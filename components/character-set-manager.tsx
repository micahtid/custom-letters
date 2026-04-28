"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowBigLeft } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CHARACTERS } from "@/lib/alphabet";
import { DrawingPad } from "@/components/drawing-pad";

const GROUPS = [
  { label: "Uppercase", chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("") },
  { label: "Lowercase", chars: "abcdefghijklmnopqrstuvwxyz".split("") },
  { label: "Numbers", chars: "0123456789".split("") },
  { label: "Symbols", chars: [".", "?", "!", ",", "'", "\"", "-", ":", ";", "(", ")", "&"] }
];

export function CharacterSetManager() {
  const glyphs = useQuery(api.glyphs.list);
  const saveGlyph = useMutation(api.glyphs.save);
  const clearGlyphs = useMutation(api.glyphs.clear);

  const [activeChar, setActiveChar] = useState(CHARACTERS[0]);
  const [padVersion, setPadVersion] = useState(0);

  const savedSet = useMemo(() => {
    const set = new Set<string>();
    for (const g of glyphs ?? []) set.add(g.character);
    return set;
  }, [glyphs]);

  const completed = savedSet.size;

  const restartCharacterSet = async () => {
    const confirmed = window.confirm(
      "Clear all saved characters and start over? This cannot be undone."
    );
    if (!confirmed) return;

    await clearGlyphs();
    setActiveChar(CHARACTERS[0]);
    setPadVersion((value) => value + 1);
  };

  const handleSave = async (dataUrl: string) => {
    await saveGlyph({ character: activeChar, dataUrl });
    const nextCharacter =
      CHARACTERS.find(
        (c) => c !== activeChar && !savedSet.has(c)
      ) ?? activeChar;
    setActiveChar(nextCharacter);
    setPadVersion((value) => value + 1);
  };

  if (glyphs === undefined) {
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
                onSave={handleSave}
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
                  const saved = savedSet.has(character);
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
