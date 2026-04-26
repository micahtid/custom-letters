"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Edit2, Trash2 } from "lucide-react";
import type { Attachment, GlyphMap, PaperStyle } from "@/lib/types";

type MessagePreviewProps = {
  glyphs: GlyphMap;
  message: string;
  paperStyle?: PaperStyle;
  paperColor?: string;
  attachments?: Attachment[];
  editingAttachmentId?: string | null;
  onUpdateAttachment?: (id: string, updates: Partial<Attachment>) => void;
  onRemoveAttachment?: (id: string) => void;
  onSelectAttachment?: (id: string) => void;
};

type Point = {
  x: number;
  y: number;
};

type AttachmentBox = {
  attachment: Attachment;
  left: number;
  top: number;
  renderWidth: number;
  renderHeight: number;
  outerWidth: number;
  outerHeight: number;
  points: Point[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
};

const LINE_HEIGHT = 44;
const LINE_GAP = 12;
const LINE_ADVANCE = LINE_HEIGHT + LINE_GAP;
const WORD_GAP = 16;
const PADDING = 64; // Increased padding for a more "paper" feel
const SAFE_ZONE = 8;
const DEFAULT_ATTACHMENT_ASPECT_RATIO = 0.8;
const ATTACHMENT_FRAME_PADDING = 8;
const ATTACHMENT_SHADOW_HALO = 0;

// A4 Aspect Ratio is 1 : 1.414
const PAPER_ASPECT_RATIO = 1.414;

let fallbackWidthContext: CanvasRenderingContext2D | null = null;

function getFallbackWidth(char: string) {
  if (typeof document === "undefined") {
    return 24;
  }

  if (!fallbackWidthContext) {
    fallbackWidthContext = document.createElement("canvas").getContext("2d");
  }

  if (!fallbackWidthContext) {
    return 24;
  }

  fallbackWidthContext.font =
    "400 23px \"Georgia\", \"Times New Roman\", serif";
  return Math.max(12, Math.ceil(fallbackWidthContext.measureText(char).width) + 4);
}

function rotatePoint(point: Point, center: Point, angleDeg: number) {
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;

  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  };
}

function getAttachmentBox(
  attachment: Attachment,
  containerWidth: number,
  pageHeight: number,
  aspectRatio: number,
  pageIndex: number
): AttachmentBox {
  const imageWidth = (attachment.width / 100) * containerWidth;
  const imageHeight = imageWidth * aspectRatio;
  const left = (attachment.x / 100) * containerWidth;
  
  // y is percentage relative to page height
  const top = (pageIndex * pageHeight) + (attachment.y / 100) * pageHeight;
  
  const framePadding = attachment.type === "sticker" ? 0 : ATTACHMENT_FRAME_PADDING;
  const outerWidth = imageWidth + framePadding * 2;
  const outerHeight = imageHeight + framePadding * 2;
  const center = { x: left + outerWidth / 2, y: top + outerHeight / 2 };
  const points = [
    rotatePoint({ x: left, y: top }, center, attachment.rotation),
    rotatePoint({ x: left + outerWidth, y: top }, center, attachment.rotation),
    rotatePoint({ x: left + outerWidth, y: top + outerHeight }, center, attachment.rotation),
    rotatePoint({ x: left, y: top + outerHeight }, center, attachment.rotation)
  ];

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return {
    attachment,
    left,
    top,
    renderWidth: imageWidth,
    renderHeight: imageHeight,
    outerWidth,
    outerHeight,
    points,
    bounds: {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    }
  };
}

function getBlockedInterval(box: AttachmentBox, top: number, bottom: number) {
  if (bottom < box.bounds.minY || top > box.bounds.maxY) {
    return null;
  }

  const xs: number[] = [];

  for (let i = 0; i < box.points.length; i += 1) {
    const a = box.points[i];
    const b = box.points[(i + 1) % box.points.length];

    const edgeMinY = Math.min(a.y, b.y);
    const edgeMaxY = Math.max(a.y, b.y);
    if (edgeMaxY < top || edgeMinY > bottom) {
      continue;
    }

    if (a.y >= top && a.y <= bottom) {
      xs.push(a.x);
    }

    if (a.y === b.y) {
      continue;
    }

    const xAt = (y: number) =>
      a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);

    if (top >= edgeMinY && top <= edgeMaxY) {
      xs.push(xAt(top));
    }
    if (bottom >= edgeMinY && bottom <= edgeMaxY) {
      xs.push(xAt(bottom));
    }
  }

  if (xs.length === 0) {
    return null;
  }

  const halo = SAFE_ZONE + ATTACHMENT_SHADOW_HALO;
  return {
    start: Math.min(...xs) - halo,
    end: Math.max(...xs) + halo
  };
}

function subtractInterval(
  segments: Array<{ start: number; end: number }>,
  blocked: { start: number; end: number }
) {
  const nextSegments: Array<{ start: number; end: number }> = [];

  for (const segment of segments) {
    if (blocked.end <= segment.start || blocked.start >= segment.end) {
      nextSegments.push(segment);
      continue;
    }

    if (blocked.start > segment.start) {
      nextSegments.push({ start: segment.start, end: blocked.start });
    }

    if (blocked.end < segment.end) {
      nextSegments.push({ start: blocked.end, end: segment.end });
    }
  }

  return nextSegments.filter((segment) => segment.end - segment.start > 8);
}

function getLineSegments(
  boxes: AttachmentBox[],
  containerWidth: number,
  top: number
) {
  let segments = [
    {
      start: PADDING,
      end: Math.max(PADDING, containerWidth - PADDING)
    }
  ];

  const bandTop = top - 4;
  const bandBottom = top + LINE_HEIGHT + 4;

  for (const box of boxes) {
    if (box.attachment.type === "sticker") {
      continue;
    }

    const blocked = getBlockedInterval(box, bandTop, bandBottom);
    if (!blocked) {
      continue;
    }

    segments = subtractInterval(segments, {
      start: Math.max(PADDING, blocked.start),
      end: Math.min(containerWidth - PADDING, blocked.end)
    });
  }

  return segments;
}

type Stroke = {
  id: string;
  points: Point[];
  color: string;
  size: number;
};

export function MessagePreview({
  glyphs,
  message,
  paperStyle = "plain",
  paperColor = "#ffffff",
  attachments = [],
  editingAttachmentId = null,
  onUpdateAttachment,
  onRemoveAttachment,
  onSelectAttachment,
  onDrawFinish,
  drawingMode = false,
  drawingSettings = { color: "#000", size: 4, isEraser: false }
}: MessagePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({
    x: 0,
    y: 0,
    initialX: 0,
    initialY: 0
  });

  // ... (rest of the component)

  const redrawCanvas = () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const allStrokes = currentStroke ? [...strokes, { id: "current", points: currentStroke, color: drawingSettings.color, size: drawingSettings.size }] : strokes;

    allStrokes.forEach(stroke => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });
  };

  useEffect(() => {
    redrawCanvas();
  }, [strokes, currentStroke, drawingMode]);

  const getCanvasPoint = (e: React.PointerEvent | PointerEvent) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e: React.PointerEvent) => {
    if (!drawingMode) return;
    const point = getCanvasPoint(e);

    if (drawingSettings.isEraser) {
      eraseAtPoint(point);
    } else {
      setCurrentStroke([point]);
    }
    setIsDrawing(true);
  };

  const draw = (e: React.PointerEvent) => {
    if (!isDrawing || !drawingMode) return;
    const point = getCanvasPoint(e);

    if (drawingSettings.isEraser) {
      eraseAtPoint(point);
    } else if (currentStroke) {
      setCurrentStroke(prev => prev ? [...prev, point] : [point]);
    }
  };

  const eraseAtPoint = (point: Point) => {
    const threshold = drawingSettings.size * 2;
    setStrokes(prev => prev.filter(stroke => {
      return !stroke.points.some(p => {
        const dx = p.x - point.x;
        const dy = p.y - point.y;
        return Math.sqrt(dx * dx + dy * dy) < threshold;
      });
    }));
  };

  const stopDrawing = () => {
    if (currentStroke && !drawingSettings.isEraser) {
      setStrokes(prev => [...prev, {
        id: Math.random().toString(36).substring(7),
        points: currentStroke,
        color: drawingSettings.color,
        size: drawingSettings.size
      }]);
    }
    setCurrentStroke(null);
    setIsDrawing(false);
  };

  // Export and clear when drawing mode is turned off
  useEffect(() => {
    if (!drawingMode && strokes.length > 0 && onDrawFinish) {
      const canvas = drawingCanvasRef.current;
      if (!canvas) return;
      
      // The canvas is already drawn by the redrawCanvas effect
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
      let found = false;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const alpha = data[(y * canvas.width + x) * 4 + 3];
          if (alpha > 0) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            found = true;
          }
        }
      }

      if (found) {
        const padding = 10;
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(canvas.width, maxX + padding);
        maxY = Math.min(canvas.height, maxY + padding);

        const trimCanvas = document.createElement("canvas");
        trimCanvas.width = maxX - minX;
        trimCanvas.height = maxY - minY;
        const trimCtx = trimCanvas.getContext("2d");
        if (trimCtx) {
          trimCtx.drawImage(canvas, minX, minY, trimCanvas.width, trimCanvas.height, 0, 0, trimCanvas.width, trimCanvas.height);
          onDrawFinish(trimCanvas.toDataURL("image/png"));
        }
      }
      
      setStrokes([]);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [drawingMode, strokes, onDrawFinish]);
  const [glyphAspectRatios, setGlyphAspectRatios] = useState<Record<string, number>>(
    {}
  );
  const [attachmentAspectRatios, setAttachmentAspectRatios] = useState<
    Record<string, number>
  >({});
  const attachmentsById = useMemo(
    () => Object.fromEntries(attachments.map((attachment) => [attachment.id, attachment])),
    [attachments]
  );

  const pageHeight = useMemo(() => {
    return containerWidth * PAPER_ASPECT_RATIO;
  }, [containerWidth]);

  useEffect(() => {
    let active = true;
    const nextGlyphEntries = Object.entries(glyphs);

    if (nextGlyphEntries.length === 0) {
      setGlyphAspectRatios({});
      return;
    }

    void Promise.all(
      nextGlyphEntries.map(
        ([char, glyph]) =>
          new Promise<[string, number]>((resolve) => {
            const image = new window.Image();

            image.onload = () => {
              resolve([
                char,
                image.naturalWidth > 0 && image.naturalHeight > 0
                  ? image.naturalWidth / image.naturalHeight
                  : 1
              ]);
            };
            image.onerror = () => resolve([char, 1]);
            image.src = glyph.dataUrl;
          })
      )
    ).then((entries) => {
      if (!active) {
        return;
      }

      setGlyphAspectRatios(Object.fromEntries(entries));
    });

    return () => {
      active = false;
    };
  }, [glyphs]);

  useEffect(() => {
    if (attachments.length === 0) {
      setAttachmentAspectRatios({});
      return;
    }

    let active = true;

    void Promise.all(
      attachments.map(
        (attachment) =>
          new Promise<[string, number]>((resolve) => {
            const image = new window.Image();

            image.onload = () => {
              resolve([
                attachment.id,
                image.naturalWidth > 0 && image.naturalHeight > 0
                  ? image.naturalHeight / image.naturalWidth
                  : DEFAULT_ATTACHMENT_ASPECT_RATIO
              ]);
            };
            image.onerror = () =>
              resolve([attachment.id, DEFAULT_ATTACHMENT_ASPECT_RATIO]);
            image.src = attachment.dataUrl;
          })
      )
    ).then((entries) => {
      if (!active) {
        return;
      }

      setAttachmentAspectRatios(Object.fromEntries(entries));
    });

    return () => {
      active = false;
    };
  }, [attachments]);

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) {
        return;
      }

      // We only care about width to define the page size
      setContainerWidth(containerRef.current.offsetWidth);
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleMouseDown = (event: React.MouseEvent, attachment: Attachment) => {
    if (editingAttachmentId !== attachment.id) {
      return;
    }

    event.preventDefault();
    setDraggingId(attachment.id);
    setDragStart({
      x: event.clientX,
      y: event.clientY,
      initialX: attachment.x,
      initialY: attachment.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!draggingId || !onUpdateAttachment || !containerRef.current || pageHeight === 0) {
        return;
      }

      const activeAttachment = attachmentsById[draggingId];
      if (!activeAttachment) {
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const contentWidth = rect.width;
      const contentHeight = pageHeight;
      const deltaX = ((event.clientX - dragStart.x) / contentWidth) * 100;
      const deltaY = ((event.clientY - dragStart.y) / contentHeight) * 100;

      const aspectRatio = attachmentAspectRatios[draggingId] ?? DEFAULT_ATTACHMENT_ASPECT_RATIO;
      const imageWidth = (activeAttachment.width / 100) * contentWidth;
      const imageHeight = imageWidth * aspectRatio;
      
      const framePadding = activeAttachment.type === "sticker" ? 0 : ATTACHMENT_FRAME_PADDING;
      const outerWidthPercent = ((imageWidth + framePadding * 2) / contentWidth) * 100;
      const outerHeightPercent = ((imageHeight + framePadding * 2) / contentHeight) * 100;

      const maxX = Math.max(0, 100 - outerWidthPercent);
      const maxY = Math.max(0, 100 - outerHeightPercent);

      onUpdateAttachment(draggingId, {
        x: Math.max(0, Math.min(maxX, dragStart.initialX + deltaX)),
        y: Math.max(0, Math.min(maxY, dragStart.initialY + deltaY))
      });
    };

    const handleMouseUp = () => setDraggingId(null);

    if (draggingId) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [attachmentsById, dragStart, draggingId, onUpdateAttachment, pageHeight]);

  const layout = useMemo(() => {
    if (containerWidth === 0 || pageHeight === 0) {
      return {
        pageCount: 1,
        boxes: [] as AttachmentBox[],
        words: [] as Array<{ word: string; x: number; y: number }>
      };
    }

    // Attachments are always relative to the current first page for now, 
    // unless we decide they can span multiple pages.
    // For simplicity, they are on page 0.
    const boxes = attachments.map((attachment) =>
      getAttachmentBox(
        attachment,
        containerWidth,
        pageHeight,
        attachmentAspectRatios[attachment.id] ?? DEFAULT_ATTACHMENT_ASPECT_RATIO,
        0
      )
    );

    const lines = message.split("\n");
    const words: Array<{ word: string; x: number; y: number }> = [];
    let currentTop = PADDING;
    let currentPageIndex = 0;

    const getWordWidth = (word: string) => {
      return Array.from(word).reduce((total, char, index) => {
        const glyphAspectRatio = glyphAspectRatios[char];
        const characterWidth = glyphAspectRatio
          ? Math.max(12, LINE_HEIGHT * glyphAspectRatio)
          : getFallbackWidth(char);

        return total + (index === 0 ? characterWidth : characterWidth - 6);
      }, 0);
    };

    const advanceToNextPage = () => {
      currentPageIndex += 1;
      return (currentPageIndex * pageHeight) + PADDING;
    };

    for (const line of lines) {
      const lineWords = line.trim().length === 0 ? [] : line.trim().split(/\s+/);

      if (lineWords.length === 0) {
        currentTop += LINE_ADVANCE;
        if (currentTop + LINE_HEIGHT > (currentPageIndex + 1) * pageHeight - PADDING) {
          currentTop = advanceToNextPage();
        }
        continue;
      }

      let wordIndex = 0;
      let bandTop = currentTop;

      while (wordIndex < lineWords.length) {
        // If the band is too low on the current page, move to next page
        if (bandTop + LINE_HEIGHT > (currentPageIndex + 1) * pageHeight - PADDING) {
          bandTop = advanceToNextPage();
        }

        const segments = getLineSegments(boxes, containerWidth, bandTop);

        if (segments.length === 0) {
          bandTop += LINE_ADVANCE;
          continue;
        }

        let placedWordOnBand = false;

        for (const segment of segments) {
          const segmentWidth = segment.end - segment.start;
          const segmentWords: Array<{ word: string; width: number }> = [];
          let usedWidth = 0;

          while (wordIndex < lineWords.length) {
            const word = lineWords[wordIndex];
            const width = getWordWidth(word);
            const nextWidth =
              segmentWords.length === 0 ? width : usedWidth + WORD_GAP + width;

            if (nextWidth > segmentWidth) {
              break;
            }

            segmentWords.push({ word, width });
            usedWidth = nextWidth;
            wordIndex += 1;
          }

          if (segmentWords.length === 0) {
            continue;
          }

          let cursor =
            segments.length > 1 && segment === segments[0]
              ? Math.max(segment.start, segment.end - usedWidth)
              : segment.start;

          for (const segmentWord of segmentWords) {
            words.push({ word: segmentWord.word, x: cursor, y: bandTop });
            cursor += segmentWord.width + WORD_GAP;
          }

          placedWordOnBand = true;

          if (wordIndex >= lineWords.length) {
            break;
          }
        }

        if (!placedWordOnBand) {
          const firstSegment = segments[0];
          const word = lineWords[wordIndex];
          words.push({ word, x: firstSegment.start, y: bandTop });
          wordIndex += 1;
        }

        if (wordIndex < lineWords.length) {
          bandTop += LINE_ADVANCE;
        }
      }

      currentTop = bandTop + LINE_ADVANCE;
    }

    const textBottom =
      words.length > 0
        ? Math.max(...words.map((word) => word.y + LINE_HEIGHT))
        : currentTop;
    const attachmentsBottom =
      boxes.length > 0
        ? Math.max(...boxes.map((box) => box.bounds.maxY + SAFE_ZONE))
        : PADDING;

    const maxContentBottom = Math.max(textBottom + PADDING, attachmentsBottom + PADDING);
    const pageCount = Math.max(1, Math.ceil(maxContentBottom / pageHeight));

    return {
      boxes,
      words,
      pageCount
    };
  }, [
    attachmentAspectRatios,
    attachments,
    containerWidth,
    pageHeight,
    glyphAspectRatios,
    message
  ]);

  const boxesById = useMemo(
    () => Object.fromEntries(layout.boxes.map((box) => [box.attachment.id, box])),
    [layout.boxes]
  );

  const pages = Array.from({ length: layout.pageCount }).map((_, i) => i);

  return (
    <div
      ref={containerRef}
      className="multi-page-container"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "40px",
        alignItems: "center",
        width: "100%",
        position: "relative"
      }}
    >
      {/* Drawing Overlay */}
      {drawingMode && (
        <canvas
          ref={drawingCanvasRef}
          width={containerWidth}
          height={layout.pageCount * pageHeight + (layout.pageCount - 1) * 40}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1000,
            cursor: "crosshair",
            touchAction: "none"
          }}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
        />
      )}

      {pages.map((pageIndex) => (
        <div
          key={`page-${pageIndex}`}
          className={`paper-sheet paper-style-${paperStyle} ${editingAttachmentId ? "note-translucent" : ""}`}
          style={{
            backgroundColor: paperColor,
            position: "relative",
            width: "100%",
            height: `${pageHeight}px`,
            overflow: "hidden",
            display: "block",
            boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
            borderRadius: "4px",
            flexShrink: 0,
            padding: 0
          }}
        >
          {/* Content for this specific page */}
          <div
            className="text-content-layer"
            style={{
              position: "absolute",
              inset: 0,
              top: `-${pageIndex * pageHeight}px`,
              pointerEvents: "none"
            }}
          >
            {layout.words
              .filter(w => w.y >= pageIndex * pageHeight && w.y < (pageIndex + 1) * pageHeight)
              .map((placedWord, wordIndex) => (
                <span
                  key={`${placedWord.word}-${placedWord.x}-${placedWord.y}-${wordIndex}`}
                  className="hand-word"
                  style={{
                    position: "absolute",
                    left: placedWord.x,
                    top: placedWord.y,
                    height: LINE_HEIGHT
                  }}
                >
                  {Array.from(placedWord.word).map((char, charIndex) => {
                    const glyph = glyphs[char];

                    return glyph ? (
                      <Image
                        key={`${placedWord.word}-${char}-${charIndex}`}
                        src={glyph.dataUrl}
                        alt={char}
                        className="glyph-image"
                        width={112}
                        height={48}
                        unoptimized
                      />
                    ) : (
                      <span
                        key={`${placedWord.word}-${char}-${charIndex}`}
                        className="fallback-char"
                      >
                        {char}
                      </span>
                    );
                  })}
                </span>
              ))}
          </div>

          {layout.boxes
            .filter(box => box.top >= pageIndex * pageHeight && box.top < (pageIndex + 1) * pageHeight)
            .map((box) => {
              const attachment = box.attachment;
              return (
                <div
                  key={attachment.id}
                  data-type={attachment.type}
                  className={`attachment-overlay ${editingAttachmentId === attachment.id ? "is-editing" : ""} ${draggingId === attachment.id ? "is-dragging" : ""}`}
                  style={{
                    position: "absolute",
                    left: box.left,
                    top: box.top - (pageIndex * pageHeight),
                    width: box.renderWidth,
                    boxSizing: "content-box",
                    backgroundColor: attachment.borderColor,
                    transform: `rotate(${attachment.rotation}deg)`,
                    filter: attachment.shadow > 0 ? `drop-shadow(0 ${attachment.shadow / 2}px ${attachment.shadow}px rgba(0,0,0,0.15))` : "none",
                    cursor:
                      editingAttachmentId === attachment.id
                        ? draggingId === attachment.id
                          ? "grabbing"
                          : "grab"
                        : "default",
                    zIndex: editingAttachmentId === attachment.id ? 100 : 10,
                    pointerEvents: "auto"
                  }}
                  onMouseDown={(event) => handleMouseDown(event, attachment)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={attachment.dataUrl} alt="" className="attachment-image" />
                  
                  <div className="preview-attachment-actions">
                    <button 
                      type="button" 
                      className="action-btn edit-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAttachment?.(attachment.id);
                      }}
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      type="button" 
                      className="action-btn delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveAttachment?.(attachment.id);
                      }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}
