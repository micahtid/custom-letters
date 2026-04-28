"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowBigLeft, Type, Grid, Square, Image as ImageIcon, X, MousePointer2, GripVertical, Layers, Sticker, Brush, Eraser } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Attachment, GlyphMap, NoteId, PaperStyle } from "@/lib/types";

const ATTACHMENT_BORDER_COLORS = [
  "#ffffff",
  "#fde68a",
  "#bfdbfe",
  "#fbcfe8",
  "#bbf7d0",
  "#1f2937"
];
import { MessagePreview } from "@/components/message-preview";

type PublishViewProps = {
  noteId: string;
};

export function PublishView({ noteId }: PublishViewProps) {
  const router = useRouter();
  const note = useQuery(api.notes.get, { id: noteId as NoteId });
  const glyphs = useQuery(api.glyphs.list);
  const shareNote = useMutation(api.notes.share);

  const [paperStyle, setPaperStyle] = useState<PaperStyle>("plain");
  const [paperColor, setPaperColor] = useState("#ffffff");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [editingAttachmentId, setEditingAttachmentId] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [draggedLayerIndex, setDraggedLayerIndex] = useState<number | null>(null);
  const [hydratedAttachments, setHydratedAttachments] = useState(false);

  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingColor, setDrawingColor] = useState("#1f2937");
  const [drawingSize, setDrawingSize] = useState(4);
  const [isEraser, setIsEraser] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (note === undefined) return;
    if (note === null) return;

    if (note.lastSharedLetterId) {
      router.replace("/");
      return;
    }

    if (!hydratedAttachments) {
      setAttachments(note.attachments ?? []);
      setHydratedAttachments(true);
    }
  }, [note, hydratedAttachments, router]);

  const glyphMap: GlyphMap = useMemo(() => {
    const map: GlyphMap = {};
    for (const g of glyphs ?? []) {
      map[g.character] = {
        character: g.character,
        dataUrl: g.dataUrl,
        updatedAt: g.updatedAt
      };
    }
    return map;
  }, [glyphs]);

  // Cap raw upload size to keep the published note under Convex's 1MB
  // document limit. Base64 encoding inflates payloads ~33%, and a single
  // letter can have several attachments stacked.
  const MAX_UPLOAD_BYTES = 500 * 1024;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      window.alert(
        `Image is too large (${Math.round(file.size / 1024)} KB). Please choose one under ${MAX_UPLOAD_BYTES / 1024} KB.`
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const nextNumber = Math.max(0, ...attachments.filter(a => a.type === "image").map(a => a.number)) + 1;
      const newAttachment: Attachment = {
        id: Math.random().toString(36).substring(7),
        type: "image",
        dataUrl,
        x: 10,
        y: 10,
        width: 30,
        rotation: 0,
        borderColor: ATTACHMENT_BORDER_COLORS[0],
        shadow: 4,
        number: nextNumber
      };
      setAttachments(prev => [...prev, newAttachment]);
      setEditingAttachmentId(newAttachment.id);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleStickerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      window.alert(
        `Sticker is too large (${Math.round(file.size / 1024)} KB). Please choose one under ${MAX_UPLOAD_BYTES / 1024} KB.`
      );
      if (stickerInputRef.current) stickerInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const nextNumber = Math.max(0, ...attachments.filter(a => a.type === "sticker").map(a => a.number)) + 1;
      const newAttachment: Attachment = {
        id: Math.random().toString(36).substring(7),
        type: "sticker",
        dataUrl,
        x: 10,
        y: 10,
        width: 30,
        rotation: 0,
        borderColor: "transparent",
        shadow: 0,
        number: nextNumber
      };
      setAttachments(prev => [...prev, newAttachment]);
      setEditingAttachmentId(newAttachment.id);
    };
    reader.readAsDataURL(file);
    if (stickerInputRef.current) stickerInputRef.current.value = "";
  };

  const handleDrawingSave = (dataUrl: string) => {
    const nextNumber = Math.max(0, ...attachments.map(a => a.number)) + 1;
    const newAttachment: Attachment = {
      id: Math.random().toString(36).substring(7),
      type: "image",
      dataUrl,
      x: 0,
      y: 0,
      width: 100,
      rotation: 0,
      borderColor: "transparent",
      shadow: 0,
      number: nextNumber
    };
    setAttachments(prev => [...prev, newAttachment]);
    setEditingAttachmentId(newAttachment.id);
    setIsDrawingMode(false);
  };

  const moveLayer = (fromIndex: number, toIndex: number) => {
    setAttachments(prev => {
      const result = [...prev];
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      return result;
    });
  };

  const handleLayerDragStart = (e: React.DragEvent, index: number) => {
    setDraggedLayerIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleLayerDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedLayerIndex === null || draggedLayerIndex === index) return;
    moveLayer(draggedLayerIndex, index);
    setDraggedLayerIndex(index);
  };

  const handleLayerDragEnd = () => {
    setDraggedLayerIndex(null);
  };

  const updateAttachment = (id: string, updates: Partial<Attachment>) => {
    setAttachments(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const updateAttachmentWidth = (id: string, nextWidth: number) => {
    setAttachments((prev) =>
      prev.map((attachment) => {
        if (attachment.id !== id) {
          return attachment;
        }

        const width = Math.max(10, Math.min(100, nextWidth));
        const centerX = attachment.x + attachment.width / 2;
        const x = Math.max(0, Math.min(100 - width, centerX - width / 2));

        return { ...attachment, width, x };
      })
    );
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
    if (editingAttachmentId === id) setEditingAttachmentId(null);
  };

  const handlePublish = async () => {
    if (!note) return;
    setIsPublishing(true);

    try {
      await shareNote({
        id: note._id,
        paperStyle,
        paperColor,
        attachments
      });
      window.location.href = "/";
    } catch (err) {
      console.error(err);
      setIsPublishing(false);
    }
  };

  const DRAWING_COLORS = ["#1f2937", "#fc5050", "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6"];

  if (note === undefined || glyphs === undefined) {
    return (
      <main className="simple-shell">
        <div className="loader-container">
          <div className="loader" />
        </div>
      </main>
    );
  }

  if (note === null) {
    return (
      <main className="simple-shell">
        <section className="empty-state">
          <h1>Note not found.</h1>
          <Link href="/" className="ghost-link back-button" aria-label="Back">
            <ArrowBigLeft />
          </Link>
        </section>
      </main>
    );
  }

  const editingAttachment = attachments.find(a => a.id === editingAttachmentId);

  return (
    <main className={`page-shell publish-page ${editingAttachmentId ? "is-editing-attachment" : ""} ${isDrawingMode ? "is-drawing-active" : ""}`}>
      <header className="page-header">
        <div className="title-group">
          <h1>Publish Your Note</h1>
        </div>
        <div className="header-actions">
          <Link href={`/notes/${noteId}`} className="ghost-link back-button" aria-label="Back to editor">
            <ArrowBigLeft />
          </Link>
        </div>
      </header>

      <div className="publish-layout">
        <aside className="publish-controls">
          {editingAttachmentId ? (
            <section className="control-section editor-controls">
              <div className="control-group">
                <span className="control-label">Size</span>
                <input
                  type="range" min="10" max="100"
                  value={editingAttachment?.width ?? 30}
                  onChange={(e) => updateAttachmentWidth(editingAttachmentId, parseInt(e.target.value))}
                />
              </div>

              <div className="control-group">
                <span className="control-label">Rotation</span>
                <input
                  type="range" min="-180" max="180"
                  value={editingAttachment?.rotation ?? 0}
                  onChange={(e) => updateAttachment(editingAttachmentId, { rotation: parseInt(e.target.value) })}
                />
              </div>

              <div className="control-group">
                <span className="control-label">Shadow</span>
                <input
                  type="range" min="0" max="20"
                  value={editingAttachment?.shadow ?? 0}
                  onChange={(e) => updateAttachment(editingAttachmentId, { shadow: parseInt(e.target.value) })}
                />
              </div>

              <div className="control-group">
                <span className="control-label">Border Color</span>
                <div className="color-picker">
                  {ATTACHMENT_BORDER_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      className={`color-btn ${editingAttachment?.borderColor === color ? "active" : ""}`}
                      style={{ backgroundColor: color }}
                      onClick={() => updateAttachment(editingAttachmentId, { borderColor: color })}
                      aria-label={`Border color ${color}`}
                    />
                  ))}
                </div>
              </div>

              <button
                className="primary-button full-width"
                onClick={() => setEditingAttachmentId(null)}
              >
                Save Changes
              </button>
            </section>
          ) : isDrawingMode ? (
            <section className="control-section editor-controls">
              <div className="control-group">
                <span className="control-label">Color</span>
                <div className="color-picker">
                  {DRAWING_COLORS.map(c => (
                    <button
                      key={c}
                      className={`color-btn ${drawingColor === c && !isEraser ? "active" : ""}`}
                      style={{ backgroundColor: c }}
                      onClick={() => {
                        setDrawingColor(c);
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

              <div className="control-group">
                <span className="control-label">Pen Size</span>
                <input
                  type="range" min="1" max="50"
                  value={drawingSize}
                  onChange={(e) => setDrawingSize(parseInt(e.target.value))}
                />
              </div>

              <button
                className="primary-button full-width"
                onClick={() => setIsDrawingMode(false)}
              >
                Done Drawing
              </button>
            </section>
          ) : (
            <>
              <section className="control-section">
                <h3 className="field-label">Paper Style</h3>
                <div className="style-picker">
                  {(["plain", "lined", "grid"] as PaperStyle[]).map(s => (
                    <button
                      key={s}
                      className={`style-btn ${paperStyle === s ? "active" : ""}`}
                      onClick={() => setPaperStyle(s)}
                    >
                      {s === "plain" ? <Square size={18} /> : s === "lined" ? <Type size={18} /> : <Grid size={18} />}
                      <span>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="control-section">
                <h3 className="field-label">Paper Color</h3>
                <div className="color-picker">
                  {["#ffffff", "#fffbeb", "#f0f9ff", "#f5f5f5", "#fdf2f8"].map(color => (
                    <button
                      key={color}
                      className={`color-btn ${paperColor === color ? "active" : ""}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setPaperColor(color)}
                    />
                  ))}
                </div>
              </section>

              <section className="control-section">
                <div className="section-header-row">
                  <h3 className="field-label">Layers</h3>
                  <div className="header-actions-small">
                    <button
                      className="ghost-button upload-small-btn"
                      onClick={() => fileInputRef.current?.click()}
                      title="Add Image"
                    >
                      <ImageIcon size={14} />
                    </button>
                    <button
                      className="ghost-button upload-small-btn"
                      onClick={() => stickerInputRef.current?.click()}
                      title="Add Sticker"
                    >
                      <Sticker size={14} />
                    </button>
                    <button
                      className="ghost-button upload-small-btn"
                      onClick={() => setIsDrawingMode(true)}
                      title="Draw"
                    >
                      <Brush size={14} />
                    </button>
                  </div>
                </div>

                <input
                  type="file"
                  accept="image/*"
                  hidden
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  ref={stickerInputRef}
                  onChange={handleStickerUpload}
                />

                <div className="layers-panel">
                  {attachments.length === 0 ? (
                    <div className="layers-empty">
                      <Layers size={24} />
                      <p>No Images Yet</p>
                    </div>
                  ) : (
                    [...attachments].reverse().map((a, i) => {
                      const actualIndex = attachments.length - 1 - i;
                      return (
                        <div
                          key={a.id}
                          className={`layer-item ${editingAttachmentId === a.id ? "active" : ""} ${draggedLayerIndex === actualIndex ? "dragging" : ""}`}
                          draggable
                          onDragStart={(e) => handleLayerDragStart(e, actualIndex)}
                          onDragOver={(e) => handleLayerDragOver(e, actualIndex)}
                          onDragEnd={handleLayerDragEnd}
                        >
                          <GripVertical size={14} className="drag-handle" />
                          <div className="layer-preview">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={a.dataUrl} alt="" />
                          </div>
                          <span className="layer-name">
                            {a.type === "sticker" ? "Sticker" : "Image"} {a.number}
                          </span>
                          <div className="layer-actions">
                            <button onClick={() => setEditingAttachmentId(a.id)} className={editingAttachmentId === a.id ? "active" : ""}>
                              <MousePointer2 size={14} />
                            </button>
                            <button onClick={() => removeAttachment(a.id)} className="danger-text">
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <div className="publish-actions">
                <button
                  className="primary-button full-width"
                  onClick={handlePublish}
                  disabled={isPublishing}
                >
                  {isPublishing ? "Publishing..." : "Publish"}
                </button>
              </div>
            </>
          )}
        </aside>

        <section className="publish-preview">
          <h3 className="field-label">Preview</h3>
          <div className="preview-container">
            <MessagePreview
              glyphs={glyphMap}
              message={note.message}
              paperStyle={paperStyle}
              paperColor={paperColor}
              attachments={attachments}
              editingAttachmentId={editingAttachmentId}
              drawingMode={isDrawingMode}
              drawingSettings={{ color: drawingColor, size: drawingSize, isEraser }}
              onUpdateAttachment={updateAttachment}
              onRemoveAttachment={removeAttachment}
              onSelectAttachment={setEditingAttachmentId}
              onDrawFinish={handleDrawingSave}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
