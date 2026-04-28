"use client";

import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { FcGoogle } from "react-icons/fc";
import { NotesDashboard } from "@/components/notes-dashboard";

type PaperStyle = "plain" | "lined" | "grid";

// Same stamp silhouette generator used by the envelope-reveal: a rectangle
// with semicircular perforation cutouts along each edge.
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

type LetterDecor = {
  kind: "letter";
  paperStyle: PaperStyle;
  color: string;
  style: React.CSSProperties;
  lines: number[];
};

type EnvelopeDecor = {
  kind: "envelope";
  color: string;
  flapColor: string;
  stampColor: string;
  postageStyle: React.CSSProperties;
  postmarkStyle: React.CSSProperties;
  style: React.CSSProperties;
};

type Decor = LetterDecor | EnvelopeDecor;

const DECORATIONS: Decor[] = [
  {
    kind: "letter",
    paperStyle: "lined",
    color: "#ffffff",
    style: { top: "5%", left: "4%", transform: "rotate(-8deg)" },
    lines: []
  },
  {
    // Envelope A — bottom-right, slight tilt (matches the real envelope)
    kind: "envelope",
    color: "#f5e9d0",
    flapColor: "#ebd9b5",
    stampColor: "#a8443a",
    style: { top: "7%", right: "6%", transform: "rotate(9deg)" },
    postageStyle: { right: "12%", bottom: "10%", transform: "rotate(-3deg)" },
    postmarkStyle: { right: "24%", bottom: "14%", transform: "rotate(-12deg)" }
  },
  {
    // Envelope B — bottom-left mirror
    kind: "envelope",
    color: "#dceaf5",
    flapColor: "#c7dcee",
    stampColor: "#1f4173",
    style: { top: "26%", left: "-2%", transform: "rotate(13deg)" },
    postageStyle: { left: "12%", bottom: "10%", transform: "rotate(5deg)" },
    postmarkStyle: { left: "24%", bottom: "14%", transform: "rotate(10deg)" }
  },
  {
    kind: "letter",
    paperStyle: "grid",
    color: "#f5f5f5",
    style: { top: "22%", right: "5%", transform: "rotate(-7deg)" },
    lines: []
  },
  {
    kind: "letter",
    paperStyle: "plain",
    color: "#fdf2f8",
    style: { top: "55%", left: "4%", transform: "rotate(15deg)" },
    lines: []
  },
  {
    // Envelope C — bottom-right, more tilt
    kind: "envelope",
    color: "#f3d6d2",
    flapColor: "#e9c2bc",
    stampColor: "#3a3a3a",
    style: { top: "50%", right: "-3%", transform: "rotate(-11deg)" },
    postageStyle: { right: "8%", bottom: "8%", transform: "rotate(14deg)" },
    postmarkStyle: { right: "22%", bottom: "12%", transform: "rotate(22deg)" }
  },
  {
    // Envelope D — bottom-center
    kind: "envelope",
    color: "#f5e9d0",
    flapColor: "#ebd9b5",
    stampColor: "#0f6e4f",
    style: { bottom: "6%", left: "10%", transform: "rotate(-6deg)" },
    postageStyle: { left: "38%", bottom: "8%", transform: "rotate(-8deg)" },
    postmarkStyle: { left: "28%", bottom: "13%", transform: "rotate(6deg)" }
  },
  {
    kind: "letter",
    paperStyle: "lined",
    color: "#fffbeb",
    style: { bottom: "8%", right: "6%", transform: "rotate(8deg)" },
    lines: []
  }
];

function LetterDecoration({ paperStyle, color, lines, style }: LetterDecor) {
  return (
    <div
      className={`decor-card decor-card--letter style-${paperStyle}`}
      style={{ ...style, backgroundColor: color }}
    >
      {lines.length > 0 && (
        <div className="decor-letter-lines">
          {lines.map((width, i) => (
            <div
              key={i}
              className="decor-letter-line"
              style={{ width: `${width}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EnvelopeDecoration({
  color,
  flapColor,
  stampColor,
  postageStyle,
  postmarkStyle,
  style
}: EnvelopeDecor) {
  return (
    <div
      className="decor-card decor-card--envelope"
      style={
        {
          ...style,
          "--env-color": color,
          "--flap-color": flapColor
        } as React.CSSProperties
      }
    >
      <span className="decor-envelope-flap" />
      <span className="decor-postage" style={postageStyle}>
        <svg viewBox="0 0 88 100" preserveAspectRatio="xMidYMid meet">
          <path d={STAMP_PATH} fill={stampColor} />
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
      </span>
      <span className="decor-postmark" style={postmarkStyle}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="#2a1d18"
            strokeWidth="2"
          />
          <circle
            cx="50"
            cy="50"
            r="38"
            fill="none"
            stroke="#2a1d18"
            strokeWidth="1.2"
          />
          <line
            x1="16"
            y1="44"
            x2="84"
            y2="44"
            stroke="#2a1d18"
            strokeWidth="0.8"
          />
          <line
            x1="16"
            y1="56"
            x2="84"
            y2="56"
            stroke="#2a1d18"
            strokeWidth="0.8"
          />
        </svg>
      </span>
    </div>
  );
}

export function HomeGate() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();

  if (isLoading) {
    return (
      <main className="simple-shell">
        <div className="loader-container">
          <div className="loader" />
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="login-shell">
        <div className="login-decor-layer" aria-hidden="true">
          {DECORATIONS.map((decor, i) =>
            decor.kind === "letter" ? (
              <LetterDecoration key={i} {...decor} />
            ) : (
              <EnvelopeDecoration key={i} {...decor} />
            )
          )}
        </div>

        <div className="login-content">
          <h1>Letters in your own hand.</h1>
          <p className="muted-copy">
            A typed note says you sent it. A handwritten one says you meant
            it. Penned makes the second as easy as the first.
          </p>
          <button
            type="button"
            className="primary-button login-button"
            onClick={() => void signIn("google")}
          >
            <FcGoogle size={18} />
            <span>Google Login</span>
          </button>
        </div>
      </main>
    );
  }

  return <NotesDashboard />;
}
