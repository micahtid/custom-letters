"use client";

import { useCallback, useEffect, useRef } from "react";
import type { GlyphMap } from "@/lib/types";

type GlyphEditorProps = {
  glyphs: GlyphMap;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

function buildNodeForChar(char: string, glyphs: GlyphMap): Node {
  if (char === "\n") {
    return document.createElement("br");
  }
  if (char === " ") {
    const space = document.createElement("span");
    space.className = "glyph-space";
    space.contentEditable = "false";
    space.textContent = " ";
    return space;
  }

  const glyph = glyphs[char];

  if (glyph) {
    const img = document.createElement("img");
    img.className = "glyph-image";
    img.src = glyph.dataUrl;
    img.alt = char;
    img.draggable = false;
    return img;
  }

  const span = document.createElement("span");
  span.className = "fallback-char";
  span.textContent = char;
  return span;
}

function buildFragment(text: string, glyphs: GlyphMap): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const char of text) {
    fragment.appendChild(buildNodeForChar(char, glyphs));
  }
  return fragment;
}

function renderStringToDOM(container: HTMLElement, text: string, glyphs: GlyphMap) {
  container.replaceChildren(buildFragment(text, glyphs));
}

function serializeDOM(container: HTMLElement): string {
  let result = "";

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent ?? "";
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const el = node as HTMLElement;

    if (el.tagName === "BR") {
      result += "\n";
      return;
    }

    if (el.tagName === "IMG") {
      result += el.getAttribute("alt") ?? "";
      return;
    }

    if (el.classList.contains("glyph-space")) {
      result += " ";
      return;
    }

    for (const child of Array.from(el.childNodes)) {
      walk(child);
    }
  };

  for (const child of Array.from(container.childNodes)) {
    walk(child);
  }

  return result;
}

function insertFragmentAtCaret(fragment: DocumentFragment) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    return;
  }

  const range = sel.getRangeAt(0);
  range.deleteContents();

  const lastNode = fragment.lastChild;
  range.insertNode(fragment);

  if (lastNode) {
    range.setStartAfter(lastNode);
    range.setEndAfter(lastNode);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

export function GlyphEditor({
  glyphs,
  value,
  onChange,
  placeholder
}: GlyphEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedValue = useRef<string | null>(null);
  const glyphsRef = useRef(glyphs);

  glyphsRef.current = glyphs;

  const emitChange = useCallback(() => {
    if (!editorRef.current) {
      return;
    }
    const text = serializeDOM(editorRef.current);
    lastEmittedValue.current = text;
    onChange(text);
  }, [onChange]);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    if (value === lastEmittedValue.current) {
      return;
    }

    renderStringToDOM(editorRef.current, value, glyphsRef.current);
    lastEmittedValue.current = value;
  }, [value]);

  useEffect(() => {
    const node = editorRef.current;
    if (!node) {
      return;
    }

    const handleBeforeInput = (event: InputEvent) => {
      const type = event.inputType;

      if (type === "insertText") {
        event.preventDefault();
        const data = event.data ?? "";
        if (data.length === 0) {
          return;
        }
        insertFragmentAtCaret(buildFragment(data, glyphsRef.current));
        emitChange();
        return;
      }

      if (type === "insertParagraph" || type === "insertLineBreak") {
        event.preventDefault();
        insertFragmentAtCaret(buildFragment("\n", glyphsRef.current));
        emitChange();
        return;
      }

      if (type === "insertFromPaste" || type === "insertFromDrop") {
        event.preventDefault();
        const data = event.dataTransfer?.getData("text/plain") ?? "";
        if (data.length === 0) {
          return;
        }
        insertFragmentAtCaret(buildFragment(data, glyphsRef.current));
        emitChange();
        return;
      }
    };

    const handleInput = () => {
      emitChange();
    };

    node.addEventListener("beforeinput", handleBeforeInput);
    node.addEventListener("input", handleInput);

    return () => {
      node.removeEventListener("beforeinput", handleBeforeInput);
      node.removeEventListener("input", handleInput);
    };
  }, [emitChange]);

  return (
    <div
      ref={editorRef}
      className="glyph-editor"
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      spellCheck={false}
    />
  );
}
