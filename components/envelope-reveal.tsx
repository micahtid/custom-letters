"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { StoredLetter } from "@/lib/types";
import { MessagePreview } from "./message-preview";

type EnvelopeRevealProps = {
  letter: StoredLetter;
};

export function EnvelopeReveal({ letter }: EnvelopeRevealProps) {
  const [opened, setOpened] = useState(false);
  const [ready, setReady] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setReady(true);
  }, []);

  const createdLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      }).format(new Date(letter.createdAt)),
    [letter.createdAt]
  );

  const playTear = () => {
    const AudioCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioCtor) {
      return;
    }

    const audioContext =
      audioContextRef.current ?? new AudioCtor({ sampleRate: 44100 });
    audioContextRef.current = audioContext;

    const duration = 1.15;
    const buffer = audioContext.createBuffer(
      1,
      audioContext.sampleRate * duration,
      audioContext.sampleRate
    );
    const channel = buffer.getChannelData(0);

    for (let index = 0; index < channel.length; index += 1) {
      const progress = index / channel.length;
      const envelope = Math.exp(-progress * 4.5);
      const scratch = Math.sin(progress * 920) * 0.2;
      channel[index] = (Math.random() * 2 - 1) * envelope * 0.55 + scratch;
    }

    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();

    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = 1500;
    filter.Q.value = 0.8;
    gain.gain.value = 0.12;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    source.start();
  };

  return (
    <main className={`reveal-page ${opened ? "opened" : ""}`}>
      <div className="reveal-copy">
        <h1>{letter.title || "A handwritten note is waiting."}</h1>
        <p>
          Shared on {createdLabel}. Open the envelope when you are ready to
          read it.
        </p>
      </div>

      <div className={`envelope-stage ${ready ? "ready" : ""}`}>
        <button
          type="button"
          className={`envelope ${opened ? "opened" : ""}`}
          onClick={() => {
            if (opened) {
              return;
            }

            setOpened(true);
            playTear();
          }}
          aria-label="Open envelope"
        >
          <div className="tear-seam" />
          <div className="tear-flap tear-left" />
          <div className="tear-flap tear-right" />
          <div className="envelope-body">
            <div className="paper-card">
              <MessagePreview
                glyphs={letter.glyphs}
                message={letter.message}
                paperStyle={letter.paperStyle}
                paperColor={letter.paperColor}
                attachments={letter.attachments}
              />
            </div>
          </div>
          <div className="wax-seal" />
        </button>
      </div>

      <Link href="/" className="ghost-link">
        Make your own
      </Link>
    </main>
  );
}
