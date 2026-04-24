import Image from "next/image";
import type { GlyphMap } from "@/lib/types";

type MessagePreviewProps = {
  glyphs: GlyphMap;
  message: string;
};

export function MessagePreview({ glyphs, message }: MessagePreviewProps) {
  const lines = message.split("\n");

  return (
    <div className="paper-sheet">
      {lines.map((line, lineIndex) => (
        <div key={`${line}-${lineIndex}`} className="hand-line">
          {line.length === 0 ? <span className="line-break-space" /> : null}
          {line
            .split(/\s+/)
            .filter((word, index) => word.length > 0 || index === 0)
            .map((word, wordIndex) => (
              <span key={`${word}-${wordIndex}`} className="hand-word">
                {Array.from(word).map((character, charIndex) => {
                  const glyph = glyphs[character];

                  if (glyph) {
                    return (
                      <Image
                        key={`${character}-${charIndex}`}
                        src={glyph.dataUrl}
                        alt={character}
                        className="glyph-image"
                        width={112}
                        height={48}
                        unoptimized
                      />
                    );
                  }

                  return (
                    <span key={`${character}-${charIndex}`} className="fallback-char">
                      {character}
                    </span>
                  );
                })}
              </span>
            ))}
        </div>
      ))}
    </div>
  );
}
