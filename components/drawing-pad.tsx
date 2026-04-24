"use client";

import { useEffect, useRef, useState } from "react";

type DrawingPadProps = {
  label: string;
  onSave: (dataUrl: string) => void | Promise<void>;
};

const BACKGROUND = { r: 253, g: 250, b: 242 };
const BACKGROUND_FILL = "#fdfaf2";
const STROKE_FILL = "#1e1a17";
const TRIM_PADDING = 10;
const COLOR_THRESHOLD = 24;
const NORMALIZED_HEIGHT = 148;
const BOTTOM_PADDING = 10;
const SIDE_PADDING = 10;

// Stroke normalization targets derived from display constants so all
// characters render visually consistent at the CSS display height.
const DISPLAY_HEIGHT = 44;
const EXPORT_HEIGHT = DISPLAY_HEIGHT * 2; // 2x for HiDPI; CSS stays at DISPLAY_HEIGHT
const TARGET_DISPLAY_STROKE = 1.4;
const TARGET_STORED_STROKE = TARGET_DISPLAY_STROKE * (NORMALIZED_HEIGHT / DISPLAY_HEIGHT);

function dilateMask(mask: Uint8Array, width: number, height: number) {
  const next = new Uint8Array(mask.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let on = 0;

      for (let dy = -1; dy <= 1 && !on; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;

          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            continue;
          }

          if (mask[ny * width + nx]) {
            on = 1;
            break;
          }
        }
      }

      next[y * width + x] = on;
    }
  }

  return next;
}

function erodeMask(mask: Uint8Array, width: number, height: number) {
  const next = new Uint8Array(mask.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let on = 1;

      for (let dy = -1; dy <= 1 && on; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;

          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            on = 0;
            break;
          }

          if (!mask[ny * width + nx]) {
            on = 0;
            break;
          }
        }
      }

      next[y * width + x] = on;
    }
  }

  return next;
}

// Two-pass chamfer distance transform. Returns, for each pixel, the
// approximate Euclidean distance to the nearest "ink" pixel (where mask[i]=1).
function computeDistFromInk(mask: Uint8Array, width: number, height: number): Float32Array {
  const INF = 1e6;
  const dist = new Float32Array(width * height).fill(INF);

  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i]) dist[i] = 0;
  }

  // Forward pass: top-left → bottom-right
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (x > 0) dist[i] = Math.min(dist[i], dist[i - 1] + 1);
      if (y > 0) dist[i] = Math.min(dist[i], dist[i - width] + 1);
      if (x > 0 && y > 0) dist[i] = Math.min(dist[i], dist[i - width - 1] + 1.4142);
      if (x < width - 1 && y > 0) dist[i] = Math.min(dist[i], dist[i - width + 1] + 1.4142);
    }
  }

  // Backward pass: bottom-right → top-left
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const i = y * width + x;
      if (x < width - 1) dist[i] = Math.min(dist[i], dist[i + 1] + 1);
      if (y < height - 1) dist[i] = Math.min(dist[i], dist[i + width] + 1);
      if (x < width - 1 && y < height - 1) dist[i] = Math.min(dist[i], dist[i + width + 1] + 1.4142);
      if (x > 0 && y < height - 1) dist[i] = Math.min(dist[i], dist[i + width - 1] + 1.4142);
    }
  }

  return dist;
}

// Parallel Zhang-Suen thinning. Reduces the ink to its 1-pixel-wide medial axis.
// Reference: Zhang & Suen, "A fast parallel algorithm for thinning digital patterns" (1984).
// Neighbor convention, clockwise from north:
//   P9 P2 P3
//   P8 P1 P4
//   P7 P6 P5
function zhangSuenThin(mask: Uint8Array, width: number, height: number): Uint8Array<ArrayBuffer> {
  const current = new Uint8Array(mask) as Uint8Array<ArrayBuffer>;
  let changed = true;

  while (changed) {
    changed = false;

    for (let step = 0; step < 2; step += 1) {
      const toRemove: number[] = [];

      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const i = y * width + x;
          if (!current[i]) continue;

          const p2 = current[i - width];
          const p3 = current[i - width + 1];
          const p4 = current[i + 1];
          const p5 = current[i + width + 1];
          const p6 = current[i + width];
          const p7 = current[i + width - 1];
          const p8 = current[i - 1];
          const p9 = current[i - width - 1];

          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;

          // A = number of 0→1 transitions walking P2,P3,P4,P5,P6,P7,P8,P9,P2.
          let a = 0;
          if (p2 === 0 && p3 === 1) a += 1;
          if (p3 === 0 && p4 === 1) a += 1;
          if (p4 === 0 && p5 === 1) a += 1;
          if (p5 === 0 && p6 === 1) a += 1;
          if (p6 === 0 && p7 === 1) a += 1;
          if (p7 === 0 && p8 === 1) a += 1;
          if (p8 === 0 && p9 === 1) a += 1;
          if (p9 === 0 && p2 === 1) a += 1;
          if (a !== 1) continue;

          if (step === 0) {
            if (p2 * p4 * p6 !== 0) continue;
            if (p4 * p6 * p8 !== 0) continue;
          } else {
            if (p2 * p4 * p8 !== 0) continue;
            if (p2 * p6 * p8 !== 0) continue;
          }

          toRemove.push(i);
        }
      }

      if (toRemove.length > 0) {
        changed = true;
        for (let k = 0; k < toRemove.length; k += 1) {
          current[toRemove[k]] = 0;
        }
      }
    }
  }

  return current;
}

function getTargetInkHeight(label: string) {
  if (label === ".") {
    return 24;
  }

  if (label === "?" || label === "!" || /\d/.test(label) || label === label.toUpperCase()) {
    return 112;
  }

  return 92;
}

export function DrawingPad({ label, onSave }: DrawingPadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<{ x: number; y: number } | null>(null);
  const [dirty, setDirty] = useState(false);

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  };

  const getNormalizedDataUrl = () => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    const { width, height } = canvas;
    const imageData = context.getImageData(0, 0, width, height);
    const { data } = imageData;

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const redDelta = Math.abs(data[index] - BACKGROUND.r);
        const greenDelta = Math.abs(data[index + 1] - BACKGROUND.g);
        const blueDelta = Math.abs(data[index + 2] - BACKGROUND.b);

        if (
          redDelta > COLOR_THRESHOLD ||
          greenDelta > COLOR_THRESHOLD ||
          blueDelta > COLOR_THRESHOLD
        ) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      return canvas.toDataURL("image/png");
    }

    const cropX = Math.max(0, minX - TRIM_PADDING);
    const cropY = Math.max(0, minY - TRIM_PADDING);
    const cropWidth = Math.min(
      width - cropX,
      maxX - minX + 1 + TRIM_PADDING * 2
    );
    const cropHeight = Math.min(
      height - cropY,
      maxY - minY + 1 + TRIM_PADDING * 2
    );

    const cropImage = context.getImageData(cropX, cropY, cropWidth, cropHeight);
    const mask = new Uint8Array(cropWidth * cropHeight);
    let inkPixels = 0;

    for (let index = 0; index < mask.length; index += 1) {
      const dataIndex = index * 4;
      const redDelta = Math.abs(cropImage.data[dataIndex] - BACKGROUND.r);
      const greenDelta = Math.abs(cropImage.data[dataIndex + 1] - BACKGROUND.g);
      const blueDelta = Math.abs(cropImage.data[dataIndex + 2] - BACKGROUND.b);

      if (
        redDelta > COLOR_THRESHOLD ||
        greenDelta > COLOR_THRESHOLD ||
        blueDelta > COLOR_THRESHOLD
      ) {
        mask[index] = 1;
        inkPixels += 1;
      }
    }

    const density = inkPixels / (cropWidth * cropHeight);
    let normalizedMask = mask;

    if (density < 0.048) {
      normalizedMask = dilateMask(normalizedMask, cropWidth, cropHeight);
    } else if (density > 0.22) {
      normalizedMask = erodeMask(normalizedMask, cropWidth, cropHeight);
    }

    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = cropWidth;
    maskCanvas.height = cropHeight;

    const maskContext = maskCanvas.getContext("2d");

    if (!maskContext) {
      return canvas.toDataURL("image/png");
    }

    const maskImage = maskContext.createImageData(cropWidth, cropHeight);

    for (let index = 0; index < normalizedMask.length; index += 1) {
      if (!normalizedMask[index]) {
        continue;
      }

      const dataIndex = index * 4;
      maskImage.data[dataIndex] = 30;
      maskImage.data[dataIndex + 1] = 26;
      maskImage.data[dataIndex + 2] = 23;
      maskImage.data[dataIndex + 3] = 255;
    }

    maskContext.putImageData(maskImage, 0, 0);

    const targetInkHeight = getTargetInkHeight(label);
    const scale = targetInkHeight / cropHeight;
    const outputWidth = Math.max(
      1,
      Math.round(cropWidth * scale) + SIDE_PADDING * 2
    );
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = outputWidth;
    outputCanvas.height = NORMALIZED_HEIGHT;

    const outputContext = outputCanvas.getContext("2d");

    if (!outputContext) {
      return canvas.toDataURL("image/png");
    }

    outputContext.clearRect(0, 0, outputWidth, NORMALIZED_HEIGHT);
    outputContext.imageSmoothingEnabled = false; // nearest-neighbor keeps binary mask clean for morphology
    outputContext.drawImage(
      maskCanvas,
      0,
      0,
      cropWidth,
      cropHeight,
      SIDE_PADDING,
      NORMALIZED_HEIGHT - BOTTOM_PADDING - targetInkHeight,
      outputWidth - SIDE_PADDING * 2,
      targetInkHeight
    );

    const outputImage = outputContext.getImageData(0, 0, outputWidth, NORMALIZED_HEIGHT);
    const outputMask = new Uint8Array(outputWidth * NORMALIZED_HEIGHT);

    for (let index = 0; index < outputMask.length; index += 1) {
      outputMask[index] = outputImage.data[index * 4 + 3] > 20 ? 1 : 0;
    }

    // Reduce the stroke to its 1-pixel-wide medial axis. This erases the user's
    // original stroke thickness, so every stroke-based glyph starts from an
    // equivalent geometric representation (just the centerline).
    const skeleton = zhangSuenThin(outputMask, outputWidth, NORMALIZED_HEIGHT);
    let skeletonCount = 0;
    for (let i = 0; i < skeleton.length; i += 1) skeletonCount += skeleton[i];

    // Build a distance field + render radius. Two regimes:
    //   (a) Stroke-based glyphs: field = distance from skeleton; radius = target/2.
    //       Re-dilating from the skeleton guarantees mathematically uniform stroke
    //       width everywhere, regardless of what the user drew.
    //   (b) Dot-like glyphs (e.g. "."): skeleton collapses to a handful of pixels
    //       which would render as an unreadably small circle. Instead, build a
    //       signed distance field from the original mask and threshold at the
    //       natural boundary, preserving the dot's intended size.
    // Both regimes feed the SAME rendering formula below, so edge quality is
    // identical across all glyphs. This is the core idea behind signed distance
    // field (SDF) glyph rendering — Chris Green, Valve, SIGGRAPH 2007.
    const distField = new Float32Array(outputWidth * NORMALIZED_HEIGHT);
    let renderRadius: number;

    if (skeletonCount >= 3) {
      // Regime (a): stroke-based glyph.
      const distFromSkeleton = computeDistFromInk(skeleton, outputWidth, NORMALIZED_HEIGHT);
      for (let i = 0; i < distField.length; i += 1) distField[i] = distFromSkeleton[i];
      renderRadius = TARGET_STORED_STROKE / 2;
    } else {
      // Regime (b): dot-like glyph. Compute signed distance field from the
      // original mask — negative inside ink, positive outside.
      const bgMask = new Uint8Array(outputMask.length);
      for (let i = 0; i < outputMask.length; i += 1) bgMask[i] = outputMask[i] ? 0 : 1;
      const distFromBg = computeDistFromInk(bgMask, outputWidth, NORMALIZED_HEIGHT);
      const distFromInk = computeDistFromInk(outputMask, outputWidth, NORMALIZED_HEIGHT);
      for (let i = 0; i < distField.length; i += 1) {
        distField[i] = outputMask[i] ? -distFromBg[i] : distFromInk[i];
      }
      renderRadius = 0; // threshold at the natural boundary
    }

    // Convert distance → alpha with a 1-pixel analytic-AA transition:
    //   field < radius - 0.5  : alpha = 1 (fully inside)
    //   field ∈ [r-0.5, r+0.5] : smooth falloff (sub-pixel precise edge)
    //   field > radius + 0.5  : alpha = 0 (fully outside)
    // Edge sharpness comes from the distance function, not from the source pixels,
    // so every glyph produces identical edge quality.
    const finalImage = outputContext.createImageData(outputWidth, NORMALIZED_HEIGHT);

    for (let index = 0; index < distField.length; index += 1) {
      const edgeDelta = renderRadius - distField[index];
      const alpha = Math.max(0, Math.min(1, edgeDelta + 0.5));

      if (alpha <= 0) continue;

      const dataIndex = index * 4;
      finalImage.data[dataIndex] = 30;
      finalImage.data[dataIndex + 1] = 26;
      finalImage.data[dataIndex + 2] = 23;
      finalImage.data[dataIndex + 3] = Math.round(alpha * 255);
    }

    outputContext.clearRect(0, 0, outputWidth, NORMALIZED_HEIGHT);
    outputContext.putImageData(finalImage, 0, 0);

    // Scale the binary result down to EXPORT_HEIGHT with smooth interpolation.
    // All glyphs go through this same step, so they all get identical anti-aliasing
    // quality at the stored size. CSS displays at DISPLAY_HEIGHT with no extra scaling.
    const exportScale = EXPORT_HEIGHT / NORMALIZED_HEIGHT;
    const exportWidth = Math.max(1, Math.round(outputWidth * exportScale));
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = exportWidth;
    exportCanvas.height = EXPORT_HEIGHT;

    const exportContext = exportCanvas.getContext("2d");

    if (!exportContext) {
      return outputCanvas.toDataURL("image/png");
    }

    exportContext.imageSmoothingEnabled = true;
    exportContext.imageSmoothingQuality = "high";
    exportContext.drawImage(outputCanvas, 0, 0, outputWidth, NORMALIZED_HEIGHT, 0, 0, exportWidth, EXPORT_HEIGHT);

    return exportCanvas.toDataURL("image/png");
  };

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.fillStyle = BACKGROUND_FILL;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = STROKE_FILL;
    context.lineWidth = 5;
    context.lineCap = "round";
    context.lineJoin = "round";
  }, [label]);

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    canvas.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event);

    if (!point) {
      return;
    }

    frameRef.current = point;
    context.beginPath();
    context.moveTo(point.x, point.y);
    setDirty(true);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const previous = frameRef.current;

    if (!canvas || !context || !previous) {
      return;
    }

    const next = getCanvasPoint(event);

    if (!next) {
      return;
    }

    context.lineTo(next.x, next.y);
    context.stroke();
    frameRef.current = next;
  };

  const stop = () => {
    frameRef.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    context.fillStyle = BACKGROUND_FILL;
    context.fillRect(0, 0, canvas.width, canvas.height);
    setDirty(false);
  };

  return (
    <div className="drawing-pad">
      <canvas
        ref={canvasRef}
        width={420}
        height={240}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerLeave={stop}
      />
      <div className="drawing-actions">
        <button type="button" className="ghost-button" onClick={clear}>
          Clear
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={!dirty}
          onClick={() => {
            const dataUrl = getNormalizedDataUrl();

            if (!dataUrl) {
              return;
            }

            void onSave(dataUrl);
          }}
        >
          Save {label}
        </button>
      </div>
    </div>
  );
}
