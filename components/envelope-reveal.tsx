"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { PublicLetter } from "@/lib/types";
import { MessagePreview } from "./message-preview";

type Phase = "closed" | "open" | "ejecting" | "reading";

const PEEL_WIDTH_FRACTION = 0.85;
const PULL_THRESHOLD = 90;

// function makeScallopedPath(width: number, height: number, radius: number) {
//   const cols = width / (2 * radius);
//   const rows = height / (2 * radius);
//   let d = "M 0 0 ";
//   for (let i = 0; i < cols; i += 1) d += `a ${radius} ${radius} 0 0 1 ${2 * radius} 0 `;
//   for (let i = 0; i < rows; i += 1) d += `a ${radius} ${radius} 0 0 1 0 ${2 * radius} `;
//   for (let i = 0; i < cols; i += 1) d += `a ${radius} ${radius} 0 0 1 ${-2 * radius} 0 `;
//   for (let i = 0; i < rows; i += 1) d += `a ${radius} ${radius} 0 0 1 0 ${-2 * radius} `;
//   return d + "Z";
// }
// const SCALLOPED_POSTCARD_PATH = makeScallopedPath(144, 96, 12);
// const SCALLOPED_SQUARE_PATH = makeScallopedPath(96, 96, 12);

// Postage stamp silhouette: rectangle with semicircular perforation cutouts
// along each edge. Tooth length = radius, cutout diameter = 2*radius.
// For perfect tiling: width/radius and height/radius must equal 3N+1.
function makeStampPath(width: number, height: number, radius: number) {
  const cyclesH = (width / radius - 1) / 3;
  const cyclesV = (height / radius - 1) / 3;
  let d = "M 0 0 ";
  for (let i = 0; i < cyclesH; i += 1) {
    d += `l ${radius} 0 a ${radius} ${radius} 0 0 0 ${2 * radius} 0 `;
  }
  d += `l ${radius} 0 `;
  for (let i = 0; i < cyclesV; i += 1) {
    d += `l 0 ${radius} a ${radius} ${radius} 0 0 0 0 ${2 * radius} `;
  }
  d += `l 0 ${radius} `;
  for (let i = 0; i < cyclesH; i += 1) {
    d += `l ${-radius} 0 a ${radius} ${radius} 0 0 0 ${-2 * radius} 0 `;
  }
  d += `l ${-radius} 0 `;
  for (let i = 0; i < cyclesV; i += 1) {
    d += `l 0 ${-radius} a ${radius} ${radius} 0 0 0 0 ${-2 * radius} `;
  }
  d += `l 0 ${-radius} `;
  return d + "Z";
}

const STAMP_PATH = makeStampPath(88, 100, 4);

export function EnvelopeReveal({ letter }: { letter: PublicLetter }) {
  const [phase, setPhase] = useState<Phase>("closed");
  const [dragProgress, setDragProgress] = useState(0);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const peelThresholdRef = useRef(280);
  const letterColor = letter.paperColor || "#fffef9";

  const createdLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date(letter.createdAt)),
    [letter.createdAt]
  );

  const advance = useCallback(() => {
    setPhase((current) => {
      if (current === "closed") return "open";
      if (current === "open") {
        setTimeout(() => setPhase("reading"), 650);
        return "ejecting";
      }
      return current;
    });
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (phase !== "closed" && phase !== "open") return;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      const rect = e.currentTarget.getBoundingClientRect();
      peelThresholdRef.current = Math.max(120, rect.width * PEEL_WIDTH_FRACTION);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [phase]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (phase === "closed") {
        const distance = Math.sqrt(dx * dx + dy * dy);
        setDragProgress(Math.min(1, distance / peelThresholdRef.current));
      } else if (phase === "open") {
        setDragProgress(Math.max(0, Math.min(1, -dy / PULL_THRESHOLD)));
      }
    },
    [phase]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragStartRef.current) return;
      if (dragProgress >= 0.5) {
        advance();
      }
      setDragProgress(0);
      dragStartRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    [advance, dragProgress]
  );

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        advance();
      }
    },
    [advance]
  );

  if (phase === "reading") {
    return (
      <main className="letter-reading">
        <div className="letter-reading__inner">
          {(letter.title || letter.createdAt) && (
            <header className="letter-reading__header">
              {letter.title && (
                <h1 className="letter-reading__title">{letter.title}</h1>
              )}
              <p className="letter-reading__date">Shared on {createdLabel}</p>
            </header>
          )}
          <MessagePreview
            glyphs={letter.glyphs}
            message={letter.message}
            paperStyle={letter.paperStyle}
            paperColor={letter.paperColor}
            attachments={letter.attachments}
          />
          <Link href="/" className="ghost-link letter-reading__footer">
            Make Your Own
          </Link>
        </div>
      </main>
    );
  }

  const isDragging = dragStartRef.current !== null && dragProgress > 0;
  const flapInlineStyle =
    phase === "closed" && isDragging
      ? {
          transform: `rotateX(${dragProgress * 180}deg)`,
          transition: "none",
        }
      : undefined;
  const letterInlineStyle: React.CSSProperties = { background: letterColor };
  if (phase === "open" && isDragging) {
    letterInlineStyle.transform = `translateY(${-dragProgress * 65}%)`;
    letterInlineStyle.transition = "none";
    letterInlineStyle.zIndex = 2;
  }

  return (
    <main className="envelope-scene">
      <div
        className={`env env--${phase}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKey}
        role="button"
        tabIndex={0}
        aria-label={
          phase === "closed"
            ? "Drag diagonally across the flap to open"
            : "Drag the letter upward to read"
        }
      >
        <div className="env__back" />
        <div className="env__letter" style={letterInlineStyle} />
        <div className="env__pocket" />
        <div className="env__flap" style={flapInlineStyle} />
        {/* <div className="env__stamp env__stamp--right" aria-hidden="true">
          <svg
            className="env__stamp-svg"
            viewBox="-14 -14 172 124"
            preserveAspectRatio="xMidYMid meet"
          >
            <path d={SCALLOPED_POSTCARD_PATH} fill="#fffef9" />
            <rect x="4" y="4" width="136" height="88" rx="1.5" fill="#d8927a" />
            <rect x="4" y="4" width="136" height="50" fill="#f5cdaa" />
            <circle cx="58" cy="30" r="10" fill="#fde9a7" />
            <path
              d="M 4 56 Q 20 28 38 54 Q 56 38 76 53 Q 96 28 116 53 Q 128 44 140 56 L 140 92 L 4 92 Z"
              fill="#a85f49"
            />
            <path
              d="M 4 74 Q 28 62 52 70 Q 76 78 100 66 Q 122 60 140 72 L 140 92 L 4 92 Z"
              fill="#7a4334"
            />
          </svg>
        </div>
        <div className="env__stamp env__stamp--left" aria-hidden="true">
          <svg
            className="env__stamp-svg"
            viewBox="-14 -14 124 124"
            preserveAspectRatio="xMidYMid meet"
          >
            <path d={SCALLOPED_SQUARE_PATH} fill="#fffef9" />
            <rect x="4" y="4" width="88" height="88" rx="1.5" fill="#3c4a6c" />
            <rect x="4" y="4" width="88" height="52" fill="#566c93" />
            <circle cx="64" cy="28" r="9" fill="#fef3d2" />
            <circle cx="60" cy="26" r="9" fill="#566c93" />
            <circle cx="14" cy="20" r="1" fill="#fef3d2" />
            <circle cx="26" cy="36" r="0.8" fill="#fef3d2" />
            <circle cx="38" cy="14" r="0.9" fill="#fef3d2" />
            <circle cx="80" cy="46" r="0.8" fill="#fef3d2" />
            <circle cx="20" cy="46" r="0.7" fill="#fef3d2" />
            <circle cx="82" cy="16" r="0.8" fill="#fef3d2" />
            <path
              d="M 4 60 Q 20 36 36 58 Q 52 44 68 58 Q 80 48 92 60 L 92 92 L 4 92 Z"
              fill="#2a3754"
            />
            <path
              d="M 4 74 Q 26 62 50 70 Q 74 78 92 68 L 92 92 L 4 92 Z"
              fill="#1a233c"
            />
          </svg>
        </div> */}
        <div className="env__stamp env__stamp--postage" aria-hidden="true">
          <svg
            className="env__stamp-svg"
            viewBox="0 0 88 100"
            preserveAspectRatio="xMidYMid meet"
          >
            <path d={STAMP_PATH} fill="#a8443a" />
            <rect
              x="9"
              y="11"
              width="70"
              height="78"
              fill="none"
              stroke="#fffef9"
              strokeWidth="0.5"
            />
            <rect
              x="11"
              y="13"
              width="66"
              height="74"
              fill="none"
              stroke="#fffef9"
              strokeWidth="0.3"
            />
          </svg>
        </div>
        <div className="env__stamp env__stamp--postmark" aria-hidden="true">
          <svg
            className="env__stamp-svg"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
          >
            <circle cx="50" cy="50" r="46" fill="none" stroke="#2a1d18" strokeWidth="2" />
            <circle cx="50" cy="50" r="38" fill="none" stroke="#2a1d18" strokeWidth="1.2" />
            <line x1="16" y1="44" x2="84" y2="44" stroke="#2a1d18" strokeWidth="0.8" />
            <line x1="16" y1="56" x2="84" y2="56" stroke="#2a1d18" strokeWidth="0.8" />
          </svg>
        </div>
      </div>

      <div className="drag-hint" aria-hidden="true">
        <span
          className={`drag-hint__label${phase === "closed" ? " is-active" : ""}`}
        >
          Swipe across the envelope
        </span>
        <span
          className={`drag-hint__label${phase !== "closed" ? " is-active" : ""}`}
        >
          Pull the letter up
        </span>
      </div>
    </main>
  );
}
