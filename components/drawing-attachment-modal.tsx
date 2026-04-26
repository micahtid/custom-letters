"use client";

import { useEffect, useRef, useState } from "react";
import { X, Eraser, Minus, Square } from "lucide-react";

type DrawingAttachmentModalProps = {
  onSave: (dataUrl: string) => void;
  onClose: () => void;
};

const COLORS = [
  "#1f2937", // Default Dark
  "#fc5050", // Red
  "#10b981", // Green
  "#3b82f6", // Blue
  "#f59e0b", // Amber
  "#8b5cf6", // Violet
];

const PEN_SIZES = [2, 4, 8, 16, 24];

export function DrawingAttachmentModal({ onSave, onClose }: DrawingAttachmentModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [penSize, setPenSize] = useState(PEN_SIZES[1]);
  const [isEraser, setIsEraser] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set initial canvas state
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPoint = (e: React.PointerEvent | PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const point = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    
    ctx.strokeStyle = isEraser ? "#ffffff" : color;
    ctx.lineWidth = penSize;
    
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const point = getPoint(e);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;

    // Create a temporary canvas to trim the drawing and handle transparency
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    let found = false;

    // Find bounding box of drawn pixels (non-transparent)
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

    if (!found) return;

    // Add some padding
    const padding = 10;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(canvas.width, maxX + padding);
    maxY = Math.min(canvas.height, maxY + padding);

    const width = maxX - minX;
    const height = maxY - minY;

    const trimCanvas = document.createElement("canvas");
    trimCanvas.width = width;
    trimCanvas.height = height;
    const trimCtx = trimCanvas.getContext("2d");
    if (!trimCtx) return;

    trimCtx.drawImage(canvas, minX, minY, width, height, 0, 0, width, height);
    onSave(trimCanvas.toDataURL("image/png"));
  };

  return (
    <div className="drawing-modal-overlay">
      <div className="drawing-modal-content">
        <header className="modal-header">
          <h2>Draw Something</h2>
          <button onClick={onClose} className="ghost-button square-btn">
            <X size={18} />
          </button>
        </header>

        <div className="drawing-toolbar">
          <div className="toolbar-group">
            <span className="control-label">Color</span>
            <div className="color-picker-small">
              {COLORS.map(c => (
                <button
                  key={c}
                  className={`color-swatch ${color === c && !isEraser ? "active" : ""}`}
                  style={{ backgroundColor: c }}
                  onClick={() => {
                    setColor(c);
                    setIsEraser(false);
                  }}
                />
              ))}
              <button 
                className={`tool-btn ${isEraser ? "active" : ""}`}
                onClick={() => setIsEraser(true)}
                title="Eraser"
              >
                <Eraser size={16} />
              </button>
            </div>
          </div>

          <div className="toolbar-group">
            <span className="control-label">Size</span>
            <div className="size-picker-small">
              {PEN_SIZES.map(s => (
                <button
                  key={s}
                  className={`size-btn ${penSize === s ? "active" : ""}`}
                  onClick={() => setPenSize(s)}
                >
                  <div style={{ width: s, height: s, borderRadius: "50%", background: "currentColor" }} />
                </button>
              ))}
            </div>
          </div>

          <div className="toolbar-group actions">
            <button onClick={clear} className="ghost-button">Clear</button>
          </div>
        </div>

        <div className="canvas-container">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerLeave={stopDrawing}
          />
        </div>

        <footer className="modal-footer">
          <button 
            className="primary-button full-width" 
            onClick={handleSave}
            disabled={!hasDrawn}
          >
            Add to Note
          </button>
        </footer>
      </div>

      <style jsx>{`
        .drawing-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(4px);
          display: grid;
          place-items: center;
          z-index: 1000;
        }
        .drawing-modal-content {
          background: var(--bg-default);
          width: min(900px, 95vw);
          border-radius: var(--radius-2xl);
          box-shadow: var(--shadow-strong);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .modal-header {
          padding: 20px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--line);
        }
        .modal-header h2 {
          font-size: var(--fs-xl);
          font-weight: var(--fw-bold);
        }
        .drawing-toolbar {
          padding: 16px 24px;
          background: var(--bg-subtle);
          display: flex;
          gap: 32px;
          border-bottom: 1px solid var(--line);
          flex-wrap: wrap;
        }
        .toolbar-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .toolbar-group.actions {
          justify-content: flex-end;
          margin-left: auto;
        }
        .color-picker-small {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .color-swatch {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          padding: 0;
        }
        .color-swatch.active {
          border-color: white;
          box-shadow: 0 0 0 2px var(--accent);
        }
        .tool-btn {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-md);
          border: 1px solid var(--line);
          background: var(--bg-default);
          display: grid;
          place-items: center;
          cursor: pointer;
          color: var(--text-secondary);
        }
        .tool-btn.active {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
        }
        .size-picker-small {
          display: flex;
          gap: 4px;
          align-items: center;
          height: 32px;
        }
        .size-btn {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          cursor: pointer;
          background: none;
          border: 1px solid transparent;
          border-radius: var(--radius-md);
          color: var(--text-secondary);
        }
        .size-btn.active {
          background: var(--accent-soft);
          border-color: var(--line);
          color: var(--accent);
        }
        .canvas-container {
          background: #eee;
          padding: 20px;
          display: grid;
          place-items: center;
          overflow: auto;
        }
        canvas {
          background: white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          cursor: crosshair;
          touch-action: none;
        }
        .modal-footer {
          padding: 20px 24px;
          border-top: 1px solid var(--line);
        }
      `}</style>
    </div>
  );
}
