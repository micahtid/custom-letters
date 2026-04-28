"use client";

import { useCallback, useEffect, useRef } from "react";
import type { GlyphMap } from "@/lib/types";

type GlyphEditorProps = {
  glyphs: GlyphMap;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

function buildCharNode(char: string, glyphs: GlyphMap): HTMLElement {
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

// Use a transparent IMG (instead of an empty contenteditable=false span) so
// the browser treats spaces atomically, identical to how glyph images
// already work — backspace deletes them cleanly and the caret sits at the
// same line-box height instead of growing.
const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

function buildSpaceNode(): HTMLElement {
  const img = document.createElement("img");
  img.className = "glyph-space";
  img.src = TRANSPARENT_PIXEL;
  img.alt = " ";
  img.draggable = false;
  return img;
}

function renderStringToDOM(container: HTMLElement, text: string, glyphs: GlyphMap) {
  container.replaceChildren();

  let currentWord: HTMLElement | null = null;

  for (const char of text) {
    if (char === "\n") {
      currentWord = null;
      container.appendChild(document.createElement("br"));
      continue;
    }

    if (char === " ") {
      currentWord = null;
      container.appendChild(buildSpaceNode());
      continue;
    }

    if (!currentWord) {
      currentWord = document.createElement("span");
      currentWord.className = "glyph-word";
      container.appendChild(currentWord);
    }

    currentWord.appendChild(buildCharNode(char, glyphs));
  }
}

function isAtomicElement(el: HTMLElement): boolean {
  if (el.tagName === "BR" || el.tagName === "IMG") return true;
  if (el.classList.contains("glyph-space")) return true;
  return false;
}

// Words are inline-block + nowrap so the caret and space handling stay
// reliable, but that means long words can overflow horizontally. Walk each
// word and, if it's wider than the editor, peel characters from its end
// into successive sibling words until everything fits.
function splitOverflowingWords(editor: HTMLElement) {
  const editorWidth = editor.clientWidth;
  if (editorWidth <= 0) return;
  const targetWidth = editorWidth - 4;

  let safety = 200;
  let changed = true;
  while (changed && safety-- > 0) {
    changed = false;
    const words = editor.querySelectorAll<HTMLElement>(".glyph-word");
    for (const word of words) {
      if (word.offsetWidth <= targetWidth) continue;
      if (word.children.length <= 1) continue;

      const newWord = document.createElement("span");
      newWord.className = "glyph-word";
      word.insertAdjacentElement("afterend", newWord);

      while (word.offsetWidth > targetWidth && word.children.length > 1) {
        const lastChild = word.lastElementChild;
        if (!lastChild) break;
        newWord.insertBefore(lastChild, newWord.firstChild);
      }

      changed = true;
      break;
    }
  }
}

function collapseLeadingSpaces(editor: HTMLElement) {
  const spaces = editor.querySelectorAll<HTMLElement>(".glyph-space");
  // First pass: reset any previously hidden spaces so layout reflects the
  // canonical state before we re-evaluate which ones need to be hidden.
  for (const space of spaces) {
    space.style.display = "";
  }
  // Second pass: hide spaces that ended up at the start of a wrapped line.
  for (const space of spaces) {
    const prev = space.previousElementSibling;
    if (!prev) continue;
    if (prev.tagName === "BR") continue;
    const spaceTop = space.getBoundingClientRect().top;
    const prevTop = prev.getBoundingClientRect().top;
    if (spaceTop - prevTop > 1) {
      space.style.display = "none";
    }
  }
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

    for (const child of Array.from(el.childNodes)) {
      walk(child);
    }
  };

  for (const child of Array.from(container.childNodes)) {
    walk(child);
  }

  return result;
}

function charLengthOf(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.length ?? 0;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return 0;
  }
  const el = node as HTMLElement;
  if (isAtomicElement(el)) {
    return 1;
  }
  let total = 0;
  for (const child of Array.from(el.childNodes)) {
    total += charLengthOf(child);
  }
  return total;
}

function getCaretCharIndex(editor: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    return 0;
  }
  const range = sel.getRangeAt(0);
  if (range.startContainer !== editor && !editor.contains(range.startContainer)) {
    return 0;
  }

  const pre = document.createRange();
  pre.selectNodeContents(editor);
  pre.setEnd(range.startContainer, range.startOffset);

  const temp = document.createElement("div");
  temp.appendChild(pre.cloneContents());
  return serializeDOM(temp).length;
}

function findCaretPosition(
  container: Node,
  index: number
): { node: Node; offset: number } {
  let remaining = index;
  const children = Array.from(container.childNodes);

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const len = charLengthOf(child);

    if (remaining < len || (remaining === 0 && len === 0)) {
      if (child.nodeType === Node.TEXT_NODE) {
        return { node: child, offset: remaining };
      }
      const el = child as HTMLElement;
      if (isAtomicElement(el)) {
        return { node: container, offset: i };
      }
      return findCaretPosition(el, remaining);
    }

    if (remaining === len) {
      if (child.nodeType === Node.TEXT_NODE) {
        return { node: child, offset: len };
      }
      const el = child as HTMLElement;
      if (isAtomicElement(el)) {
        return { node: container, offset: i + 1 };
      }
      // For wrappers at exact-end position, place caret inside at the end so
      // the next typed character continues the word rather than starting a new one.
      return findCaretPosition(el, len);
    }

    remaining -= len;
  }

  return { node: container, offset: children.length };
}

function placeCaretAtCharIndex(editor: HTMLElement, index: number) {
  const target = findCaretPosition(editor, index);
  const range = document.createRange();
  range.setStart(target.node, target.offset);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
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

function buildPlainFragment(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  let buffer = "";
  const flushBuffer = () => {
    if (buffer.length > 0) {
      fragment.appendChild(document.createTextNode(buffer));
      buffer = "";
    }
  };
  for (const char of text) {
    if (char === "\n") {
      flushBuffer();
      fragment.appendChild(document.createElement("br"));
    } else {
      buffer += char;
    }
  }
  flushBuffer();
  return fragment;
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

  const normalize = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const text = serializeDOM(editor);
    const caretIndex = getCaretCharIndex(editor);
    renderStringToDOM(editor, text, glyphsRef.current);
    splitOverflowingWords(editor);
    placeCaretAtCharIndex(editor, caretIndex);
    collapseLeadingSpaces(editor);

    if (text !== lastEmittedValue.current) {
      lastEmittedValue.current = text;
      onChange(text);
    }
  }, [onChange]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    if (value === lastEmittedValue.current) {
      return;
    }
    // Preserve caret across external value changes so a re-hydration or
    // sync from Convex doesn't drop the user back to the start of the doc.
    const isFocused = document.activeElement === editor;
    const caretIndex = isFocused ? getCaretCharIndex(editor) : 0;
    renderStringToDOM(editor, value, glyphsRef.current);
    splitOverflowingWords(editor);
    if (isFocused) {
      placeCaretAtCharIndex(editor, Math.min(caretIndex, value.length));
    }
    collapseLeadingSpaces(editor);
    lastEmittedValue.current = value;
  }, [value]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      splitOverflowingWords(editor);
      collapseLeadingSpaces(editor);
    });
    observer.observe(editor);
    return () => observer.disconnect();
  }, []);

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
        insertFragmentAtCaret(buildPlainFragment(data));
        normalize();
        return;
      }

      if (type === "insertParagraph" || type === "insertLineBreak") {
        event.preventDefault();
        insertFragmentAtCaret(buildPlainFragment("\n"));
        normalize();
        return;
      }

      if (type === "insertFromPaste" || type === "insertFromDrop") {
        event.preventDefault();
        const data = event.dataTransfer?.getData("text/plain") ?? "";
        if (data.length === 0) {
          return;
        }
        insertFragmentAtCaret(buildPlainFragment(data));
        normalize();
        return;
      }

      // Explicit deletion handling — operate on the text model rather than
      // letting the browser fight contenteditable atomic elements.
      if (
        type === "deleteContentBackward" ||
        type === "deleteContentForward" ||
        type === "deleteByCut" ||
        type === "deleteWordBackward" ||
        type === "deleteWordForward"
      ) {
        const editor = node;
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);

        event.preventDefault();
        const text = serializeDOM(editor);
        const startIdx = getCaretCharIndex(editor);

        let from = startIdx;
        let to = startIdx;

        if (!range.collapsed) {
          // For a real selection, compute the selection's char range.
          const endRange = document.createRange();
          endRange.selectNodeContents(editor);
          endRange.setEnd(range.endContainer, range.endOffset);
          const endTemp = document.createElement("div");
          endTemp.appendChild(endRange.cloneContents());
          to = serializeDOM(endTemp).length;
        } else if (type === "deleteContentBackward") {
          if (startIdx === 0) return;
          from = startIdx - 1;
        } else if (type === "deleteWordBackward") {
          if (startIdx === 0) return;
          let i = startIdx - 1;
          while (i > 0 && /\s/.test(text[i])) i -= 1;
          while (i > 0 && !/\s/.test(text[i - 1])) i -= 1;
          from = i;
        } else if (type === "deleteContentForward") {
          if (startIdx === text.length) return;
          to = startIdx + 1;
        } else if (type === "deleteWordForward") {
          if (startIdx === text.length) return;
          let i = startIdx;
          while (i < text.length && /\s/.test(text[i])) i += 1;
          while (i < text.length && !/\s/.test(text[i])) i += 1;
          to = i;
        }

        if (from === to) return;
        const newText = text.slice(0, from) + text.slice(to);
        renderStringToDOM(editor, newText, glyphsRef.current);
        splitOverflowingWords(editor);
        placeCaretAtCharIndex(editor, from);
        collapseLeadingSpaces(editor);

        if (newText !== lastEmittedValue.current) {
          lastEmittedValue.current = newText;
          onChange(newText);
        }
        return;
      }
    };

    const handleInput = () => {
      normalize();
    };

    node.addEventListener("beforeinput", handleBeforeInput);
    node.addEventListener("input", handleInput);

    return () => {
      node.removeEventListener("beforeinput", handleBeforeInput);
      node.removeEventListener("input", handleInput);
    };
  }, [normalize, onChange]);

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
