import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bold,
  Camera,
  Check,
  CheckSquare,
  Code2,
  Heading2,
  Highlighter,
  ImagePlus,
  Italic,
  Languages,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Lock,
  Mic,
  MicOff,
  Minus,
  Palette,
  PenTool,
  Plus,
  Quote,
  Redo2,
  ScanText,
  Strikethrough,
  Table2,
  Trash2,
  Underline,
  Undo2,
  X,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition as NativeSpeechRecognition } from '@capacitor-community/speech-recognition';
import { useBackHandler, useNotes } from '../context/NotesContext';
import { scanTextFromImageFile } from '../services/ocrService';
import { TEXT_TOOLS_CATALOG, TextToolMeta } from '../services/textToolsService';
import { EditorCursorTarget, TextToolId } from '../types/notes';
import {
  placeCaretAtCharOffset,
  placeCaretAtEnd,
  readAndCompressImage,
  sanitizeNoteThemeElements,
  sanitizeNoteThemeHtml,
} from '../utils/noteHelpers';
import { TRANSLATE_LANGUAGES, translateText } from '../utils/translateHelper';
import { SketchModal } from './SketchModal';

const NOTE_TEXT_COLORS = [
  { id: 'default', label: 'Default', swatch: '' },
  { id: 'red', label: 'Red', swatch: '#C62828' },
  { id: 'orange', label: 'Orange', swatch: '#C2590A' },
  { id: 'green', label: 'Green', swatch: '#2E7D32' },
  { id: 'blue', label: 'Blue', swatch: '#1D4ED8' },
  { id: 'purple', label: 'Purple', swatch: '#7E22CE' },
  { id: 'gray', label: 'Gray', swatch: '#6B7280' },
] as const;

function escapeHtmlText(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error?: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

interface RichTextEditorProps {
  title: string;
  content: string;
  images: string[];
  onChangeTitle: (title: string) => void;
  onChangeContent: (html: string) => void;
  onChangeImages: (images: string[]) => void;
  autoFocusBody?: boolean;
  initialCursorTarget?: EditorCursorTarget | null;
}

interface DragGhostState {
  src: string;
  x: number;
  y: number;
}

function createImageBlockElement(src: string): HTMLDivElement {
  const block = document.createElement('div');
  block.className = 'note-image-block';
  block.setAttribute('contenteditable', 'false');
  block.setAttribute('data-image-block', 'true');

  const img = document.createElement('img');
  img.src = src;
  img.alt = 'Note image';
  img.setAttribute('referrerpolicy', 'no-referrer');
  img.setAttribute('draggable', 'false');

  const controls = document.createElement('div');
  controls.className = 'note-image-controls';

  const dragBtn = document.createElement('button');
  dragBtn.type = 'button';
  dragBtn.className = 'note-img-drag';
  dragBtn.setAttribute('data-action', 'drag-image');
  dragBtn.setAttribute('aria-label', 'Drag to move image');
  dragBtn.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'note-img-remove';
  removeBtn.setAttribute('data-action', 'remove-image');
  removeBtn.setAttribute('aria-label', 'Remove image');
  removeBtn.innerHTML =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

  controls.appendChild(dragBtn);
  controls.appendChild(removeBtn);
  block.appendChild(img);
  block.appendChild(controls);

  return block;
}

function getChildNodeRect(node: ChildNode): DOMRect | null {
  if (node.nodeType === Node.ELEMENT_NODE) {
    return (node as HTMLElement).getBoundingClientRect();
  }
  if (node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim().length > 0) {
    const range = document.createRange();
    range.selectNodeContents(node);
    const rect = range.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) return rect;
  }
  return null;
}

export function RichTextEditor({
  title,
  content,
  images,
  onChangeTitle,
  onChangeContent,
  onChangeImages,
  autoFocusBody = false,
  initialCursorTarget = null,
}: RichTextEditorProps) {
  const { isPremium, maxImagesAllowed, requestUpgrade, showToast, textToolsConfig } = useNotes();
  const toolRules = textToolsConfig.tools;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const appliedCursorTargetRef = useRef<EditorCursorTarget | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const ocrGalleryInputRef = useRef<HTMLInputElement>(null);
  const ocrCameraInputRef = useRef<HTMLInputElement>(null);
  const insertMenuRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const historyRef = useRef<string[]>([content || '']);
  const historyIndexRef = useRef<number>(0);
  const isInternalChangeRef = useRef<boolean>(false);
  const savedRangeRef = useRef<Range | null>(null);

  const dragSessionRef = useRef<{
    blockEl: HTMLElement;
    imgSrc: string;
    startX: number;
    startY: number;
    active: boolean;
    insertBeforeNode: ChildNode | null;
  } | null>(null);

  const [dragGhost, setDragGhost] = useState<DragGhostState | null>(null);
  const [dropIndicatorTop, setDropIndicatorTop] = useState<number | null>(null);
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  const [isBodyFocused, setIsBodyFocused] = useState(false);
  const [sketchOpen, setSketchOpen] = useState(false);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [tableColsInput, setTableColsInput] = useState('3');
  const [tableRowsInput, setTableRowsInput] = useState('3');
  const activeTableCellRef = useRef<HTMLTableCellElement | null>(null);
  const [activeTableContext, setActiveTableContext] = useState<{
    rowCount: number;
    colCount: number;
    isHeaderRow: boolean;
  } | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState<'bn-BD' | 'en-US'>('bn-BD');
  const [interimTranscript, setInterimTranscript] = useState('');
  const manualStopRef = useRef(false);
  const [translateOpen, setTranslateOpen] = useState(false);
  const [translateSourceText, setTranslateSourceText] = useState('');
  const [translatingLang, setTranslatingLang] = useState<string | null>(null);
  const translateRangeRef = useRef<Range | null>(null);
  const [colorBarOpen, setColorBarOpen] = useState(false);
  const [activeTextColor, setActiveTextColor] = useState<string>('default');
  const colorRangeRef = useRef<Range | null>(null);
  const [ocrSheetOpen, setOcrSheetOpen] = useState(false);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [sizeSliderOpen, setSizeSliderOpen] = useState(false);
  const [activeFontSize, setActiveFontSize] = useState(18);
  const activeSizeGroupRef = useRef<string | null>(null);
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const isSlidingRef = useRef(false);

  const MIN_TEXT_SIZE = 10;
  const MAX_TEXT_SIZE = 42;

  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    unorderedList: false,
    orderedList: false,
  });

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncActiveTableFromNode = useCallback((node: Node | null) => {
    const editor = editorRef.current;
    if (!editor || !node || !editor.contains(node)) {
      activeTableCellRef.current = null;
      setActiveTableContext((prev) => (prev ? null : prev));
      return;
    }

    const baseEl =
      node.nodeType === Node.TEXT_NODE
        ? node.parentElement
        : (node as HTMLElement | null);
    const cell = baseEl?.closest('td, th') as HTMLTableCellElement | null;
    const table = cell?.closest('table') as HTMLTableElement | null;
    const tr = cell?.closest('tr') as HTMLTableRowElement | null;

    if (!cell || !table || !tr || !editor.contains(table)) {
      activeTableCellRef.current = null;
      setActiveTableContext((prev) => (prev ? null : prev));
      return;
    }

    activeTableCellRef.current = cell;
    const nextCtx = {
      rowCount: table.querySelectorAll('tr').length,
      colCount: tr.children.length,
      isHeaderRow: Boolean(cell.closest('thead')),
    };

    setActiveTableContext((prev) => {
      if (
        prev &&
        prev.rowCount === nextCtx.rowCount &&
        prev.colCount === nextCtx.colCount &&
        prev.isHeaderRow === nextCtx.isHeaderRow
      ) {
        return prev;
      }
      return nextCtx;
    });
  }, []);

  const saveSelection = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
      syncActiveTableFromNode(range.commonAncestorContainer);
    }
  }, [syncActiveTableFromNode]);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== content && !isInternalChangeRef.current) {
      editorRef.current.innerHTML = sanitizeNoteThemeHtml(content || '');
      historyRef.current = [editorRef.current.innerHTML];
      historyIndexRef.current = 0;
      savedRangeRef.current = null;
      activeTableCellRef.current = null;
      setActiveTableContext(null);
      setCanUndo(false);
      setCanRedo(false);
    }
  }, [content]);

  useEffect(() => {
    if (autoFocusBody && editorRef.current) {
      editorRef.current.focus();
    }
  }, [autoFocusBody]);

  useEffect(() => {
    const handleSelectionChange = () => {
      const editor = editorRef.current;
      if (!editor) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
        syncActiveTableFromNode(range.commonAncestorContainer);
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [syncActiveTableFromNode]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (insertMenuRef.current && !insertMenuRef.current.contains(e.target as Node)) {
        setInsertMenuOpen(false);
      }
    };
    if (insertMenuOpen) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [insertMenuOpen]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
      }
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore cleanup stop errors
      }
    };
  }, []);

  const updateToolbarState = useCallback(() => {
    try {
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        unorderedList: document.queryCommandState('insertUnorderedList'),
        orderedList: document.queryCommandState('insertOrderedList'),
      });
      const sel = window.getSelection();
      const editor = editorRef.current;
      if (sel && sel.rangeCount > 0 && editor && editor.contains(sel.anchorNode)) {
        const baseEl =
          sel.anchorNode?.nodeType === Node.TEXT_NODE
            ? sel.anchorNode.parentElement
            : (sel.anchorNode as HTMLElement | null);
        const colorEl = baseEl?.closest('[data-note-color]') as HTMLElement | null;
      setActiveTextColor(colorEl?.getAttribute('data-note-color') || 'default');
      }
    } catch {
      // Ignore selection errors
    }
  }, []);

  useEffect(() => {
    if (!initialCursorTarget || appliedCursorTargetRef.current === initialCursorTarget) {
      return;
    }
    appliedCursorTargetRef.current = initialCursorTarget;

    let rafId: number | null = null;
    let keyboardTimerId: number | null = null;

    if (initialCursorTarget.type === 'title') {
      const input = titleInputRef.current;
      if (!input) return;
      input.focus({ preventScroll: true });
      const clamped = Math.min(Math.max(0, initialCursorTarget.offset), input.value.length);
      input.setSelectionRange(clamped, clamped);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;

    const range =
      initialCursorTarget.type === 'body-offset'
        ? placeCaretAtCharOffset(editor, initialCursorTarget.offset)
        : placeCaretAtEnd(editor);

    editor.focus({ preventScroll: true });
    setIsBodyFocused(true);

    if (range) {
      savedRangeRef.current = range.cloneRange();
      syncActiveTableFromNode(range.startContainer);
    }
    updateToolbarState();

    const scrollCaretIntoPosition = (usePreferredY: boolean) => {
      const container = scrollContainerRef.current;
      if (!container) return;

      if (initialCursorTarget.type === 'body-end') {
        container.scrollTop = container.scrollHeight;
        return;
      }

      if (!range) return;
      const rects = range.getClientRects();
      let caretRect: DOMRect | null =
        rects.length > 0 && (rects[0].height > 0 || rects[0].top > 0) ? rects[0] : null;
      if (!caretRect) {
        const bounding = range.getBoundingClientRect();
        if (bounding.height > 0 || bounding.top > 0) {
          caretRect = bounding;
        } else {
          const fallbackEl =
            range.startContainer.nodeType === Node.TEXT_NODE
              ? range.startContainer.parentElement
              : (range.startContainer as HTMLElement | null);
          if (fallbackEl) {
            caretRect = fallbackEl.getBoundingClientRect();
          }
        }
      }
      if (!caretRect) return;

      const containerRect = container.getBoundingClientRect();
      if (usePreferredY) {
        const desiredTopInContainer =
          initialCursorTarget.preferredViewportY !== undefined
            ? Math.min(
                Math.max(initialCursorTarget.preferredViewportY - containerRect.top, 48),
                Math.max(48, containerRect.height - 72)
              )
            : containerRect.height * 0.38;
        const delta = caretRect.top - containerRect.top - desiredTopInContainer;
        container.scrollTop = Math.max(0, container.scrollTop + delta);
      } else if (document.activeElement === editor) {
        if (caretRect.bottom > containerRect.bottom - 20) {
          container.scrollTop += caretRect.bottom - (containerRect.bottom - 48);
        } else if (caretRect.top < containerRect.top + 16) {
          container.scrollTop = Math.max(
            0,
            container.scrollTop - (containerRect.top + 24 - caretRect.top)
          );
        }
      }
    };

    scrollCaretIntoPosition(true);
    rafId = window.requestAnimationFrame(() => scrollCaretIntoPosition(true));
    keyboardTimerId = window.setTimeout(() => scrollCaretIntoPosition(false), 260);

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      if (keyboardTimerId !== null) window.clearTimeout(keyboardTimerId);
    };
  }, [initialCursorTarget, syncActiveTableFromNode, updateToolbarState]);

  const pushHistory = useCallback((html: string) => {
    const stack = historyRef.current;
    const idx = historyIndexRef.current;
    if (stack[idx] === html) return;
    const nextStack = stack.slice(0, idx + 1);
    nextStack.push(html);
    if (nextStack.length > 60) nextStack.shift();
    historyRef.current = nextStack;
    historyIndexRef.current = nextStack.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  const emitChange = useCallback(() => {
    if (!editorRef.current) return;
    sanitizeNoteThemeElements(editorRef.current);
    const html = editorRef.current.innerHTML;
    isInternalChangeRef.current = true;
    pushHistory(html);
    onChangeContent(html);
    window.setTimeout(() => {
      isInternalChangeRef.current = false;
    }, 0);
    updateToolbarState();
  }, [onChangeContent, pushHistory, updateToolbarState]);

  const getTotalImageCount = useCallback(() => {
    const inlineCount = editorRef.current?.querySelectorAll('.note-image-block').length ?? 0;
    return inlineCount + images.length;
  }, [images.length]);

  const insertImageBlocksAtSavedRange = useCallback(
    (srcs: string[]) => {
      const editor = editorRef.current;
      if (!editor || srcs.length === 0) return;

      const blocks = srcs.map((src) => createImageBlockElement(src));
      const lastBlock = blocks[blocks.length - 1];

      editor.focus();

      let range = savedRangeRef.current;
      if (!range || !editor.contains(range.commonAncestorContainer)) {
        range = null;
      }

      if (range) {
        if (!range.collapsed) {
          range.deleteContents();
        }

        // Find direct child of editor containing the cursor
        let directChild: Node | null = range.startContainer;
        while (directChild && directChild.parentNode !== editor) {
          directChild = directChild.parentNode;
        }

        if (directChild && directChild.nodeType === Node.TEXT_NODE) {
          const textNode = directChild as Text;
          const afterText = textNode.splitText(range.startOffset);
          let refNode: Node = afterText;
          blocks.forEach((blk) => {
            editor.insertBefore(blk, refNode);
          });
          if (!afterText.textContent || afterText.textContent.length === 0) {
            afterText.remove();
          }
        } else if (directChild && directChild.nodeType === Node.ELEMENT_NODE) {
          const directEl = directChild as HTMLElement;

          if (directEl.classList.contains('note-image-block')) {
            let insertAfter: Node = directEl;
            blocks.forEach((blk) => {
              editor.insertBefore(blk, insertAfter.nextSibling);
              insertAfter = blk;
            });
          } else if (directEl.tagName === 'UL' || directEl.tagName === 'OL') {
            let insertAfter: Node = directEl;
            blocks.forEach((blk) => {
              editor.insertBefore(blk, insertAfter.nextSibling);
              insertAfter = blk;
            });
          } else {
            // Split block element at cursor so text before stays above and text after stays below
            const tailRange = document.createRange();
            tailRange.setStart(range.endContainer, range.endOffset);
            tailRange.setEnd(directEl, directEl.childNodes.length);
            const tailFragment = tailRange.extractContents();

            let insertAfter: Node = directEl;
            blocks.forEach((blk) => {
              editor.insertBefore(blk, insertAfter.nextSibling);
              insertAfter = blk;
            });

            const tailHasText = Boolean(tailFragment.textContent && tailFragment.textContent.trim().length > 0);
            const tailHasElements = tailFragment.querySelectorAll('br, img, span, b, i, u, strong, em').length > 0;
            if (tailHasText || tailHasElements) {
              const tag = directEl.tagName === 'H2' || directEl.tagName === 'BLOCKQUOTE' ? directEl.tagName.toLowerCase() : 'p';
              const afterBlock = document.createElement(tag);
              afterBlock.appendChild(tailFragment);
              if (!afterBlock.textContent?.trim() && !afterBlock.querySelector('br')) {
                afterBlock.innerHTML = '<br>';
              }
              editor.insertBefore(afterBlock, lastBlock.nextSibling);
            }

            if (
              !directEl.textContent?.trim() &&
              directEl.querySelectorAll('img, .note-image-block, .note-check-item').length === 0
            ) {
              // Keep blank line above if it's not the only element or remove empty placeholder cleanly
              if (directEl.innerHTML === '') {
                directEl.innerHTML = '<br>';
              }
            }
          }
        } else {
          blocks.forEach((blk) => editor.appendChild(blk));
        }
      } else {
        blocks.forEach((blk) => editor.appendChild(blk));
      }

      // Ensure there is an editable paragraph right after the inserted image if none exists
      let nextEditable = lastBlock.nextElementSibling as HTMLElement | null;
      if (!nextEditable || nextEditable.classList.contains('note-image-block')) {
        const trailingP = document.createElement('p');
        trailingP.innerHTML = '<br>';
        editor.insertBefore(trailingP, lastBlock.nextSibling);
        nextEditable = trailingP;
      }

      // Place caret inside the element following the inserted image
      try {
        const sel = window.getSelection();
        if (sel && nextEditable) {
          const nextRange = document.createRange();
          nextRange.setStart(nextEditable, 0);
          nextRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(nextRange);
          savedRangeRef.current = nextRange.cloneRange();
        }
      } catch {
        // Ignore selection placement error
      }

      emitChange();
    },
    [emitChange]
  );

  // Window-level pointer listeners for vertical drag-and-drop image reordering
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const session = dragSessionRef.current;
      const editor = editorRef.current;
      const wrapper = editorWrapperRef.current;
      if (!session || !editor || !wrapper) return;

      const dx = e.clientX - session.startX;
      const dy = e.clientY - session.startY;

      if (!session.active) {
        if (Math.hypot(dx, dy) < 6) return;
        session.active = true;
        session.blockEl.classList.add('is-dragging');
      }

      e.preventDefault();
      setDragGhost({ src: session.imgSrc, x: e.clientX, y: e.clientY });

      // Smooth auto-scroll near viewport top/bottom while dragging
      if (e.clientY < 96) {
        window.scrollBy(0, -10);
      } else if (e.clientY > window.innerHeight - 96) {
        window.scrollBy(0, 10);
      }

      // Compute drop position among direct child nodes of editor
      const wrapperRect = wrapper.getBoundingClientRect();
      const children = Array.from(editor.childNodes).filter((node) => {
        if (node === session.blockEl) return false;
        return getChildNodeRect(node) !== null;
      });

      let insertBeforeNode: ChildNode | null = null;
      let indicatorY: number | null = null;

      for (const child of children) {
        const rect = getChildNodeRect(child);
        if (!rect) continue;
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          insertBeforeNode = child;
          indicatorY = rect.top - wrapperRect.top - 4;
          break;
        }
      }

      if (insertBeforeNode === null) {
        if (children.length > 0) {
          const lastRect = getChildNodeRect(children[children.length - 1]);
          if (lastRect) {
            indicatorY = lastRect.bottom - wrapperRect.top + 4;
          }
        } else {
          indicatorY = 8;
        }
      }

      session.insertBeforeNode = insertBeforeNode;
      setDropIndicatorTop(indicatorY);
    };

    const finishDrag = () => {
      const session = dragSessionRef.current;
      const editor = editorRef.current;
      if (!session) return;
      dragSessionRef.current = null;

      session.blockEl.classList.remove('is-dragging');
      setDragGhost(null);
      setDropIndicatorTop(null);

      if (session.active && editor) {
        const { blockEl, insertBeforeNode } = session;
        if (insertBeforeNode && insertBeforeNode !== blockEl && insertBeforeNode !== blockEl.nextSibling) {
          editor.insertBefore(blockEl, insertBeforeNode);
        } else if (insertBeforeNode === null && editor.lastChild !== blockEl) {
          editor.appendChild(blockEl);
        }

        // Ensure trailing editable paragraph if image ended up last
        if (editor.lastElementChild === blockEl) {
          const trailingP = document.createElement('p');
          trailingP.innerHTML = '<br>';
          editor.appendChild(trailingP);
        }

        emitChange();
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  }, [emitChange]);

  const handleEditorPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-action="remove-image"]')) {
      return;
    }

    const dragBtn = target.closest('[data-action="drag-image"]');
    const blockEl = target.closest('.note-image-block') as HTMLElement | null;
    if (!blockEl) return;

    const isMouseImgDrag =
      e.pointerType === 'mouse' && target.tagName === 'IMG' && blockEl.contains(target);

    if (!dragBtn && !isMouseImgDrag) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const imgEl = blockEl.querySelector('img');
    if (!imgEl?.src) return;

    if (dragBtn) {
      e.preventDefault();
    }

    dragSessionRef.current = {
      blockEl,
      imgSrc: imgEl.src,
      startX: e.clientX,
      startY: e.clientY,
      active: Boolean(dragBtn),
      insertBeforeNode: null,
    };

    if (dragBtn) {
      blockEl.classList.add('is-dragging');
      setDragGhost({ src: imgEl.src, x: e.clientX, y: e.clientY });
    }
  };

  const handleFormat = (command: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    emitChange();
  };

  const handleToggleHighlight = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const currentBg = (document.queryCommandValue('hiliteColor') || '')
      .replace(/\s+/g, '')
      .toLowerCase();
    const isHighlighted =
      currentBg === '#fff1b8' ||
      currentBg === 'rgb(255,241,184)' ||
      currentBg === 'rgba(255,241,184,1)';
    document.execCommand('hiliteColor', false, isHighlighted ? 'transparent' : '#FFF1B8');
    emitChange();
  };

  const restoreSavedRange = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (!sel) return;
    if (savedRangeRef.current && editor.contains(savedRangeRef.current.commonAncestorContainer)) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
  }, []);

  const handleInsertDivider = () => {
    setInsertMenuOpen(false);
    restoreSavedRange();
    document.execCommand('insertHTML', false, '<hr /><p><br></p>');
    emitChange();
  };

  const handleInsertCodeBlock = () => {
    setInsertMenuOpen(false);
    const editor = editorRef.current;
    if (!editor) return;

    restoreSavedRange();
    const sel = window.getSelection();
    const selectedText =
      sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).commonAncestorContainer)
        ? sel.toString()
        : '';

    const blockId = `cb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const codeContent = selectedText ? escapeHtmlText(selectedText) : '<br>';
    const codeHtml =
      `<div class="note-code-block" data-code-block="true" data-cb-id="${blockId}">` +
      `<div class="note-code-header" contenteditable="false">` +
      `<span class="note-code-lang">Code</span>` +
      `<button type="button" class="note-code-copy" data-action="copy-code">Copy</button>` +
      `</div>` +
      `<pre><code>${codeContent}</code></pre>` +
      `</div><p><br></p>`;

    document.execCommand('insertHTML', false, codeHtml);

    const inserted = editor.querySelector(`[data-cb-id="${blockId}"]`);
    if (inserted) {
      inserted.removeAttribute('data-cb-id');
      const codeEl = inserted.querySelector('pre code');
      if (codeEl && sel) {
        const range = document.createRange();
        range.selectNodeContents(codeEl);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        savedRangeRef.current = range.cloneRange();
      }
    }

    emitChange();
  };

  const closeColorBar = useCallback(() => {
    setColorBarOpen(false);
    colorRangeRef.current = null;
  }, []);

  useBackHandler(colorBarOpen, closeColorBar);

  const handleOpenColorBar = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const sel = window.getSelection();
    let range: Range | null = null;
    if (sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      range = sel.getRangeAt(0);
    } else if (
      savedRangeRef.current &&
      editor.contains(savedRangeRef.current.commonAncestorContainer)
    ) {
      range = savedRangeRef.current;
    }

    if (range && !range.collapsed && range.toString().trim()) {
      colorRangeRef.current = range.cloneRange();
      setSizeSliderOpen(false);
      closeTranslateBar();
      setInsertMenuOpen(false);
      setColorBarOpen((prev) => !prev);
      return;
    }

    if (colorBarOpen) {
      closeColorBar();
    } else {
      showToast('Select text first to change color');
    }
  };

  const handleApplyTextColor = (colorId: (typeof NOTE_TEXT_COLORS)[number]['id']) => {
    const editor = editorRef.current;
    if (!editor) return;

    const sel = window.getSelection();
    let range: Range | null = null;
    if (
      sel &&
      sel.rangeCount > 0 &&
      editor.contains(sel.getRangeAt(0).commonAncestorContainer) &&
      !sel.getRangeAt(0).collapsed
    ) {
      range = sel.getRangeAt(0);
    } else if (
      colorRangeRef.current &&
      editor.contains(colorRangeRef.current.commonAncestorContainer) &&
      !colorRangeRef.current.collapsed
    ) {
      range = colorRangeRef.current;
    }

    if (!range || range.collapsed || !range.toString().trim()) {
      showToast('Select text first to change color');
      return;
    }

    editor.focus();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }

    document.execCommand('fontSize', false, '7');
    const createdFonts = Array.from(editor.querySelectorAll('font[size="7"]'));
    if (createdFonts.length === 0) {
      showToast('Select text first to change color');
      return;
    }

    const resultingNodes: Node[] = [];

    createdFonts.forEach((fontEl) => {
      fontEl.querySelectorAll('[data-note-color]').forEach((nested) => {
        const parent = nested.parentNode;
        if (!parent) return;
        while (nested.firstChild) {
          parent.insertBefore(nested.firstChild, nested);
        }
        parent.removeChild(nested);
      });

      if (colorId === 'default') {
        const ancestor = fontEl.closest('[data-note-color]') as HTMLElement | null;
        if (ancestor && editor.contains(ancestor)) {
          const ancestorColor = ancestor.getAttribute('data-note-color');
          const beforeRange = document.createRange();
          beforeRange.setStart(ancestor, 0);
          beforeRange.setEndBefore(fontEl);
          const beforeFrag = beforeRange.extractContents();

          const afterRange = document.createRange();
          afterRange.setStartAfter(fontEl);
          afterRange.setEnd(ancestor, ancestor.childNodes.length);
          const afterFrag = afterRange.extractContents();

          const parent = ancestor.parentNode;
          if (parent) {
            if (beforeFrag.textContent || beforeFrag.querySelector('*')) {
              const beforeSpan = document.createElement('span');
              if (ancestorColor) beforeSpan.setAttribute('data-note-color', ancestorColor);
              beforeSpan.appendChild(beforeFrag);
              parent.insertBefore(beforeSpan, ancestor);
            }
            while (fontEl.firstChild) {
              const child = fontEl.firstChild;
              parent.insertBefore(child, ancestor);
              resultingNodes.push(child);
            }
            if (afterFrag.textContent || afterFrag.querySelector('*')) {
              const afterSpan = document.createElement('span');
              if (ancestorColor) afterSpan.setAttribute('data-note-color', ancestorColor);
              afterSpan.appendChild(afterFrag);
              parent.insertBefore(afterSpan, ancestor);
            }
            ancestor.remove();
            return;
          }
        }

        const parent = fontEl.parentNode;
        if (parent) {
          while (fontEl.firstChild) {
            const child = fontEl.firstChild;
            parent.insertBefore(child, fontEl);
            resultingNodes.push(child);
          }
          parent.removeChild(fontEl);
        }
      } else {
        const span = document.createElement('span');
        span.setAttribute('data-note-color', colorId);
        while (fontEl.firstChild) {
          span.appendChild(fontEl.firstChild);
        }
        fontEl.parentNode?.replaceChild(span, fontEl);

        const parentEl = span.parentElement;
        if (
          parentEl &&
          parentEl.hasAttribute('data-note-color') &&
          parentEl.childNodes.length === 1
        ) {
          parentEl.parentNode?.replaceChild(span, parentEl);
        }
        resultingNodes.push(span);
      }
    });

    if (sel && resultingNodes.length > 0) {
      const nextRange = document.createRange();
      nextRange.setStartBefore(resultingNodes[0]);
      nextRange.setEndAfter(resultingNodes[resultingNodes.length - 1]);
      sel.removeAllRanges();
      sel.addRange(nextRange);
      savedRangeRef.current = nextRange.cloneRange();
      colorRangeRef.current = nextRange.cloneRange();
    }

    setActiveTextColor(colorId);
    emitChange();
  };

  useBackHandler(ocrSheetOpen, () => {
    if (!ocrScanning) setOcrSheetOpen(false);
  });

  const handleOpenOcrScanner = () => {
    saveSelection();
    setInsertMenuOpen(false);
    setOcrSheetOpen(true);
  };

  const handleOcrFileSelected = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || ocrScanning) return;
    setOcrScanning(true);
    try {
      const extracted = await scanTextFromImageFile(file);
      if (!extracted) {
        showToast('No readable text found in image');
        return;
      }
      setOcrSheetOpen(false);
      restoreSavedRange();

      const paragraphs = extracted
        .split(/\n{2,}/)
        .map((para) =>
          `<p>${para
            .split(/\n/)
            .map((line) => escapeHtmlText(line))
            .join('<br>')}</p>`
        )
        .join('');

      const ok = document.execCommand('insertHTML', false, paragraphs || escapeHtmlText(extracted));
      if (!ok) {
        document.execCommand('insertText', false, extracted);
      }
      saveSelection();
      emitChange();
      showToast('Scanned text inserted');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not scan text from image',
        'danger'
      );
    } finally {
      setOcrScanning(false);
    }
  };

  const handleOpenTableModal = () => {
    saveSelection();
    setInsertMenuOpen(false);
    setTableColsInput('3');
    setTableRowsInput('3');
    setTableModalOpen(true);
  };

  const handleConfirmTable = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedCols = parseInt(tableColsInput, 10);
    const parsedRows = parseInt(tableRowsInput, 10);
    if (!Number.isFinite(parsedCols) || parsedCols < 1 || !Number.isFinite(parsedRows) || parsedRows < 1) {
      return;
    }
    const cols = Math.min(500, parsedCols);
    const rows = Math.min(2000, parsedRows);

    setTableModalOpen(false);
    restoreSavedRange();

    const headerCells = Array.from(
      { length: cols },
      (_, idx) => `<th>Column ${idx + 1}</th>`
    ).join('');
    const bodyCells = Array.from({ length: cols }, () => '<td><br></td>').join('');
    const bodyRows = Array.from({ length: rows }, () => `<tr>${bodyCells}</tr>`).join('');

    const tableHtml =
      `<div class="note-table-wrap"><table class="note-table"><thead><tr>${headerCells}</tr></thead>` +
      `<tbody>${bodyRows}</tbody></table></div><p><br></p>`;
    document.execCommand('insertHTML', false, tableHtml);
    emitChange();
  };

  const focusTableCell = (cell: HTMLTableCellElement | null) => {
    const editor = editorRef.current;
    if (!editor || !cell || !editor.contains(cell)) return;
    editor.focus();
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.selectNodeContents(cell);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    savedRangeRef.current = range.cloneRange();
    syncActiveTableFromNode(cell);
  };

  const getActiveTableParts = () => {
    const editor = editorRef.current;
    let cell = activeTableCellRef.current;
    if (!cell || !editor?.contains(cell)) {
      const node = savedRangeRef.current?.commonAncestorContainer;
      if (node && editor?.contains(node)) {
        const baseEl =
          node.nodeType === Node.TEXT_NODE
            ? node.parentElement
            : (node as HTMLElement | null);
        cell = baseEl?.closest('td, th') as HTMLTableCellElement | null;
      }
    }
    if (!cell || !editor?.contains(cell)) return null;
    const tr = cell.closest('tr') as HTMLTableRowElement | null;
    const table = cell.closest('table') as HTMLTableElement | null;
    if (!tr || !table || !editor.contains(table)) return null;
    return { cell, tr, table };
  };

  const handleTableAddRow = () => {
    const parts = getActiveTableParts();
    if (!parts) return;
    const { cell, tr, table } = parts;
    const colIdx = Math.max(0, Array.from(tr.children).indexOf(cell));
    const colCount = tr.children.length || table.rows[0]?.cells.length || 1;

    const newTr = document.createElement('tr');
    for (let i = 0; i < colCount; i += 1) {
      const td = document.createElement('td');
      td.innerHTML = '<br>';
      newTr.appendChild(td);
    }

    if (tr.closest('thead')) {
      let tbody = table.querySelector('tbody');
      if (!tbody) {
        tbody = document.createElement('tbody');
        table.appendChild(tbody);
      }
      tbody.insertBefore(newTr, tbody.firstChild);
    } else {
      tr.parentNode?.insertBefore(newTr, tr.nextSibling);
    }

    const nextCell =
      (newTr.children[Math.min(colIdx, newTr.children.length - 1)] as HTMLTableCellElement) ||
      null;
    focusTableCell(nextCell);
    emitChange();
  };

  const handleTableDeleteRow = () => {
    const parts = getActiveTableParts();
    if (!parts) return;
    const { cell, tr, table } = parts;
    if (tr.closest('thead')) return;
    const totalRows = table.querySelectorAll('tr').length;
    if (totalRows <= 1) return;

    const colIdx = Math.max(0, Array.from(tr.children).indexOf(cell));
    const siblingRow =
      (tr.nextElementSibling as HTMLTableRowElement | null) ||
      (tr.previousElementSibling as HTMLTableRowElement | null) ||
      (table.querySelector('thead tr') as HTMLTableRowElement | null);

    tr.remove();

    const nextCell = siblingRow
      ? ((siblingRow.children[
          Math.min(colIdx, siblingRow.children.length - 1)
        ] as HTMLTableCellElement) || null)
      : null;
    focusTableCell(nextCell);
    emitChange();
  };

  const handleTableAddColumn = () => {
    const parts = getActiveTableParts();
    if (!parts) return;
    const { cell, tr, table } = parts;
    const colIdx = Math.max(0, Array.from(tr.children).indexOf(cell));
    const allRows = Array.from(table.querySelectorAll('tr'));
    let focusTarget: HTMLTableCellElement | null = null;

    allRows.forEach((row) => {
      const isHead =
        Boolean(row.closest('thead')) || row.firstElementChild?.tagName === 'TH';
      const newCell = document.createElement(isHead ? 'th' : 'td') as HTMLTableCellElement;
      if (isHead) {
        newCell.textContent = `Column ${row.children.length + 1}`;
      } else {
        newCell.innerHTML = '<br>';
      }
      const refCell = row.children[colIdx] || null;
      row.insertBefore(newCell, refCell ? refCell.nextSibling : null);
      if (row === tr) {
        focusTarget = newCell;
      }
    });

    focusTableCell(focusTarget);
    emitChange();
  };

  const handleTableDeleteColumn = () => {
    const parts = getActiveTableParts();
    if (!parts) return;
    const { cell, tr, table } = parts;
    if (tr.children.length <= 1) return;

    const colIdx = Math.max(0, Array.from(tr.children).indexOf(cell));
    const allRows = Array.from(table.querySelectorAll('tr'));

    allRows.forEach((row) => {
      const targetCell = row.children[colIdx];
      if (targetCell) {
        targetCell.remove();
      }
    });

    const nextCell =
      (tr.children[Math.min(colIdx, tr.children.length - 1)] as HTMLTableCellElement) || null;
    focusTableCell(nextCell);
    emitChange();
  };

  const handleTableDeleteWhole = () => {
    const parts = getActiveTableParts();
    const editor = editorRef.current;
    if (!parts || !editor) return;
    const { table } = parts;
    const removeTarget = table.closest('.note-table-wrap') || table;

    let nextEditable = removeTarget.nextElementSibling as HTMLElement | null;
    if (!nextEditable) {
      nextEditable = document.createElement('p');
      nextEditable.innerHTML = '<br>';
      removeTarget.parentNode?.insertBefore(nextEditable, removeTarget.nextSibling);
    }

    removeTarget.remove();
    activeTableCellRef.current = null;
    setActiveTableContext(null);

    editor.focus();
    try {
      const sel = window.getSelection();
      if (sel && nextEditable) {
        const range = document.createRange();
        range.setStart(nextEditable, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        savedRangeRef.current = range.cloneRange();
      }
    } catch {
      // Ignore selection placement errors
    }

    emitChange();
  };

  const handleOpenLinkModal = () => {
    saveSelection();
    setInsertMenuOpen(false);
    const sel = window.getSelection();
    const selectedText = sel && editorRef.current?.contains(sel.anchorNode) ? sel.toString() : '';
    setLinkText(selectedText);
    setLinkUrl('');
    setLinkModalOpen(true);
  };

  const handleConfirmLink = (e: React.FormEvent) => {
    e.preventDefault();
    const rawUrl = linkUrl.trim();
    if (!rawUrl) return;
    const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const displayText = linkText.trim() || rawUrl;

    setLinkModalOpen(false);
    restoreSavedRange();

    const safeHref = normalizedUrl.replace(/"/g, '&quot;');
    const safeLabel = displayText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    document.execCommand(
      'insertHTML',
      false,
      `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>&nbsp;`
    );
    emitChange();
  };

  const handleOpenSketch = () => {
    saveSelection();
    setInsertMenuOpen(false);
    const totalCount = getTotalImageCount();
    if (!isPremium && totalCount >= maxImagesAllowed) {
      requestUpgrade(
        maxImagesAllowed <= 0
          ? 'Images & sketches require Notes Premium. Upgrade for unlimited media.'
          : `Free plan allows ${maxImagesAllowed} ${maxImagesAllowed === 1 ? 'image or sketch' : 'images or sketches'} per note. Upgrade to Notes Premium for unlimited media.`
      );
      return;
    }
    setSketchOpen(true);
  };

  const closeTranslateBar = useCallback(() => {
    setTranslateOpen(false);
    setTranslateSourceText('');
    setTranslatingLang(null);
    translateRangeRef.current = null;
  }, []);

  useBackHandler(translateOpen, closeTranslateBar);

  const handleOpenTranslateBar = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const sel = window.getSelection();
    let range: Range | null = null;
    if (sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      range = sel.getRangeAt(0);
    } else if (
      savedRangeRef.current &&
      editor.contains(savedRangeRef.current.commonAncestorContainer)
    ) {
      range = savedRangeRef.current;
    }

    const selectedText = range ? range.toString().trim() : '';
    if (!range || range.collapsed || !selectedText) {
      if (translateOpen) {
        closeTranslateBar();
      } else {
        showToast('Select text first to translate');
      }
      return;
    }

    translateRangeRef.current = range.cloneRange();
    setTranslateSourceText(selectedText);
    setSizeSliderOpen(false);
    setInsertMenuOpen(false);
    setTranslateOpen(true);
  };

  const handleRunTranslate = async (targetCode: string, targetLabel: string) => {
    if (!translateSourceText || translatingLang) return;
    setTranslatingLang(targetCode);
    try {
      const translated = await translateText(translateSourceText, targetCode);
      const editor = editorRef.current;
      const savedRange = translateRangeRef.current;
      if (editor && savedRange && editor.contains(savedRange.commonAncestorContainer)) {
        editor.focus();
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(savedRange);
        }
        const replaced = document.execCommand('insertText', false, translated);
        if (!replaced) {
          savedRange.deleteContents();
          const textNode = document.createTextNode(translated);
          savedRange.insertNode(textNode);
          savedRange.setStartAfter(textNode);
          savedRange.collapse(true);
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(savedRange);
          }
        }
        saveSelection();
        emitChange();
      }
      closeTranslateBar();
      showToast(`Translated to ${targetLabel}`);
    } catch {
      showToast('Translation failed. Check your connection.');
      setTranslatingLang(null);
    }
  };

  const stopWebRecognition = useCallback(() => {
    manualStopRef.current = true;
    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignore stop errors
    }
    recognitionRef.current = null;
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const startWebRecognition = useCallback(
    (activeLang: 'bn-BD' | 'en-US') => {
      const win = window as unknown as {
        SpeechRecognition?: SpeechRecognitionCtor;
        webkitSpeechRecognition?: SpeechRecognitionCtor;
      };
      const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

      if (!SpeechRec) {
        showToast('Voice typing is not supported in this browser');
        return;
      }

      manualStopRef.current = false;
      saveSelection();
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = activeLang;

      recognition.onresult = (event) => {
        let finalText = '';
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const piece = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) {
            finalText += `${piece.trim()} `;
          } else {
            interimText += piece;
          }
        }
        setInterimTranscript(interimText.trim());
        if (finalText.trim() && editorRef.current) {
          restoreSavedRange();
          document.execCommand('insertText', false, finalText);
          saveSelection();
          emitChange();
        }
      };

      recognition.onerror = (event) => {
        const errCode = event?.error || '';
        setIsListening(false);
        setInterimTranscript('');
        if (errCode === 'aborted' || manualStopRef.current) return;
        if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
          showToast('Microphone permission denied');
        } else if (errCode === 'no-speech') {
          showToast('No speech detected. Try again.');
        } else if (errCode === 'audio-capture') {
          showToast('No microphone found');
        } else if (errCode === 'network') {
          showToast('Network error during voice typing');
        } else {
          showToast('Could not capture voice input');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      try {
        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
        setInsertMenuOpen(false);
      } catch {
        setIsListening(false);
        setInterimTranscript('');
        showToast('Microphone permission unavailable');
      }
    },
    [emitChange, restoreSavedRange, saveSelection, showToast]
  );

  const handleToggleVoice = async (overrideLang?: 'bn-BD' | 'en-US') => {
    const activeLang = overrideLang || speechLang;
    if (overrideLang) setSpeechLang(overrideLang);

    let isNative = false;
    try {
      isNative = Capacitor.isNativePlatform();
    } catch {
      isNative = false;
    }

    if (isNative) {
      if (isListening && !overrideLang) {
        try {
          await NativeSpeechRecognition.stop();
        } catch {
          // Ignore stop errors
        }
        setIsListening(false);
        return;
      }

      try {
        const { available } = await NativeSpeechRecognition.available();
        if (!available) {
          showToast('Voice typing is unavailable on this device');
          return;
        }
        const perm = await NativeSpeechRecognition.checkPermissions();
        if (perm.speechRecognition !== 'granted') {
          const requested = await NativeSpeechRecognition.requestPermissions();
          if (requested.speechRecognition !== 'granted') {
            showToast('Microphone permission denied');
            return;
          }
        }

        saveSelection();
        setInsertMenuOpen(false);
        setIsListening(true);
        const result = await NativeSpeechRecognition.start({
          language: activeLang,
          maxResults: 1,
          prompt: activeLang === 'bn-BD' ? 'বাংলায় বলুন...' : 'Speak in English...',
          partialResults: false,
          popup: true,
        });
        setIsListening(false);
        const spoken = result?.matches?.[0]?.trim();
        if (spoken && editorRef.current) {
          restoreSavedRange();
          document.execCommand('insertText', false, `${spoken} `);
          saveSelection();
          emitChange();
        }
      } catch {
        setIsListening(false);
      }
      return;
    }

    if (isListening && !overrideLang) {
      stopWebRecognition();
      return;
    }

    if (isListening && overrideLang) {
      stopWebRecognition();
      window.setTimeout(() => startWebRecognition(activeLang), 180);
      return;
    }

    startWebRecognition(activeLang);
  };

  const handleSwitchVoiceLanguage = (nextLang: 'bn-BD' | 'en-US') => {
    setSpeechLang(nextLang);
    setInsertMenuOpen(false);
    if (isListening) {
      stopWebRecognition();
      window.setTimeout(() => startWebRecognition(nextLang), 180);
    } else {
      showToast(`Voice language: ${nextLang === 'bn-BD' ? 'বাংলা' : 'English'}`);
    }
  };

  const isToolEnabled = (id: TextToolId) => toolRules[id]?.enabled !== false;
  const isToolPremium = (id: TextToolId) => Boolean(toolRules[id]?.premium);

  const runToolAction = (id: TextToolId, upgradeTitle: string, action: () => void) => {
    if (!isToolEnabled(id)) return;
    if (isToolPremium(id) && !isPremium) {
      requestUpgrade(`${upgradeTitle} is part of Notes Premium.`);
      return;
    }
    action();
  };

  const handleInsertChecklist = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const checkHtml =
      '<div class="note-check-item" data-checked="false">' +
      '<span class="note-check-box" role="checkbox" aria-checked="false" tabindex="0"></span>' +
      '<span class="note-check-text">Checklist item</span>' +
      '</div><p><br></p>';
    document.execCommand('insertHTML', false, checkHtml);
    emitChange();
  };

  const closeSizeSlider = useCallback(() => {
    setSizeSliderOpen(false);
    activeSizeGroupRef.current = null;
  }, []);

  useBackHandler(sizeSliderOpen, closeSizeSlider);
  useBackHandler(linkModalOpen, () => setLinkModalOpen(false));

  const applyFontSizeToActiveGroup = useCallback((nextSize: number, commitHistory: boolean) => {
    const editor = editorRef.current;
    const groupId = activeSizeGroupRef.current;
    if (!editor || !groupId) return;

    const clamped = Math.max(MIN_TEXT_SIZE, Math.min(MAX_TEXT_SIZE, Math.round(nextSize)));
    setActiveFontSize(clamped);

    const targets = editor.querySelectorAll<HTMLElement>(`[data-size-group="${groupId}"]`);
    targets.forEach((el) => {
      el.style.fontSize = `${clamped}px`;
      el.style.lineHeight = '1.35';
    });

    if (commitHistory) {
      emitChange();
    }
  }, [emitChange]);

  const updateSliderFromClientX = useCallback(
    (clientX: number, commitHistory: boolean) => {
      const track = sliderTrackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const nextSize = Math.round(MIN_TEXT_SIZE + ratio * (MAX_TEXT_SIZE - MIN_TEXT_SIZE));
      applyFontSizeToActiveGroup(nextSize, commitHistory);
    },
    [applyFontSizeToActiveGroup]
  );

  const handleOpenTextSizeSlider = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const sel = window.getSelection();
    let range: Range | null = null;
    if (sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      range = sel.getRangeAt(0);
    } else if (
      savedRangeRef.current &&
      editor.contains(savedRangeRef.current.commonAncestorContainer)
    ) {
      range = savedRangeRef.current;
    }

    if (!range || range.collapsed || !range.toString().trim()) {
      if (sizeSliderOpen) {
        closeSizeSlider();
      } else {
        showToast('Select text first to resize');
      }
      return;
    }

    // Measure current computed font-size at selection start
    let startEl: HTMLElement | null =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as HTMLElement)
        : range.startContainer.parentElement;
    if (!startEl || !editor.contains(startEl)) {
      startEl = editor;
    }
    const existingSpan = startEl.closest('.note-sized-text') as HTMLElement | null;
    const rawSize = parseFloat(
      existingSpan?.style.fontSize || window.getComputedStyle(startEl).fontSize || '16'
    );
    const initialSize = Math.max(MIN_TEXT_SIZE, Math.min(MAX_TEXT_SIZE, Math.round(rawSize || 16)));

    editor.focus();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }

    const groupId = `fs_${Date.now()}`;
    document.execCommand('fontSize', false, '7');

    const createdFonts = Array.from(editor.querySelectorAll('font[size="7"]'));
    if (createdFonts.length === 0) {
      showToast('Select text first to resize');
      return;
    }

    const wrappedSpans: HTMLSpanElement[] = [];
    createdFonts.forEach((fontEl) => {
      const span = document.createElement('span');
      span.className = 'note-sized-text';
      span.setAttribute('data-size-group', groupId);
      span.style.fontSize = `${initialSize}px`;
      span.style.lineHeight = '1.35';
      while (fontEl.firstChild) {
        span.appendChild(fontEl.firstChild);
      }

      // Unwrap any nested sized spans inside the new selection wrapper
      span.querySelectorAll('.note-sized-text').forEach((nested) => {
        const parent = nested.parentNode;
        if (!parent) return;
        while (nested.firstChild) {
          parent.insertBefore(nested.firstChild, nested);
        }
        parent.removeChild(nested);
      });

      fontEl.parentNode?.replaceChild(span, fontEl);

      // If parent is an old .note-sized-text containing only this new span, replace the parent cleanly
      const parentEl = span.parentElement;
      if (
        parentEl &&
        parentEl.classList.contains('note-sized-text') &&
        parentEl.childNodes.length === 1
      ) {
        parentEl.parentNode?.replaceChild(span, parentEl);
      }

      wrappedSpans.push(span);
    });

    if (sel && wrappedSpans.length > 0) {
      const nextRange = document.createRange();
      nextRange.setStartBefore(wrappedSpans[0]);
      nextRange.setEndAfter(wrappedSpans[wrappedSpans.length - 1]);
      sel.removeAllRanges();
      sel.addRange(nextRange);
      savedRangeRef.current = nextRange.cloneRange();
    }

    activeSizeGroupRef.current = groupId;
    setActiveFontSize(initialSize);
    closeTranslateBar();
    setSizeSliderOpen(true);
    emitChange();
  };

  const handleToggleBlockquote = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const currentBlock = document.queryCommandValue('formatBlock');
    if (currentBlock && currentBlock.toLowerCase() === 'blockquote') {
      document.execCommand('formatBlock', false, 'p');
    } else {
      document.execCommand('formatBlock', false, 'blockquote');
    }
    emitChange();
  };

  const handleImageTrigger = (picker: 'gallery' | 'camera') => {
    saveSelection();
    const totalCount = getTotalImageCount();
    if (!isPremium && totalCount >= maxImagesAllowed) {
      requestUpgrade(
        maxImagesAllowed <= 0
          ? 'Adding images requires Notes Premium. Upgrade for unlimited images.'
          : `Free plan allows ${maxImagesAllowed} ${maxImagesAllowed === 1 ? 'image' : 'images'} per note. Upgrade to Notes Premium for unlimited images.`
      );
      return;
    }
    if (picker === 'gallery') {
      fileInputRef.current?.click();
    } else {
      cameraInputRef.current?.click();
    }
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const totalCount = getTotalImageCount();
    const remainingSlots = isPremium ? files.length : Math.max(0, maxImagesAllowed - totalCount);
    if (remainingSlots <= 0) {
      requestUpgrade(
        maxImagesAllowed <= 0
          ? 'Adding images requires Notes Premium. Upgrade for unlimited images.'
          : `Free plan allows ${maxImagesAllowed} ${maxImagesAllowed === 1 ? 'image' : 'images'} per note. Upgrade to Notes Premium for unlimited images.`
      );
      return;
    }

    const loaded: string[] = [];
    for (const file of Array.from(files).slice(0, remainingSlots)) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const compressed = await readAndCompressImage(file);
        loaded.push(compressed);
      } catch {
        // Skip unreadable image
      }
    }
    if (loaded.length > 0) {
      insertImageBlocksAtSavedRange(loaded);
      if (!isPremium && files.length > remainingSlots) {
        requestUpgrade(
          `Only ${maxImagesAllowed} ${maxImagesAllowed === 1 ? 'image was' : 'images were'} attached on the Free plan. Upgrade for unlimited images.`
        );
      }
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) imageFiles.push(f);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      saveSelection();
      const totalCount = getTotalImageCount();
      if (!isPremium && totalCount >= maxImagesAllowed) {
        requestUpgrade(
          maxImagesAllowed <= 0
            ? 'Adding images requires Notes Premium. Upgrade for unlimited images.'
            : `Free plan allows ${maxImagesAllowed} ${maxImagesAllowed === 1 ? 'image' : 'images'} per note. Upgrade to Notes Premium for unlimited images.`
        );
        return;
      }
      const loaded: string[] = [];
      const limit = isPremium ? imageFiles.length : Math.max(0, maxImagesAllowed - totalCount);
      for (const file of imageFiles.slice(0, limit)) {
        try {
          loaded.push(await readAndCompressImage(file));
        } catch {
          // Ignore
        }
      }
      if (loaded.length > 0) {
        insertImageBlocksAtSavedRange(loaded);
      }
      return;
    }

    const pastedHtml = e.clipboardData?.getData('text/html');
    if (pastedHtml) {
      e.preventDefault();
      const cleanedHtml = sanitizeNoteThemeHtml(pastedHtml);
      document.execCommand('insertHTML', false, cleanedHtml);
      emitChange();
      return;
    }

    window.setTimeout(() => {
      if (editorRef.current) {
        sanitizeNoteThemeElements(editorRef.current);
        emitChange();
      }
    }, 0);
  };

  const handleRemoveLegacyImage = (index: number) => {
    onChangeImages(images.filter((_, i) => i !== index));
  };

  const handleUndo = () => {
    if (historyIndexRef.current <= 0 || !editorRef.current) return;
    historyIndexRef.current -= 1;
    const prevHtml = historyRef.current[historyIndexRef.current];
    editorRef.current.innerHTML = prevHtml;
    isInternalChangeRef.current = true;
    onChangeContent(prevHtml);
    window.setTimeout(() => {
      isInternalChangeRef.current = false;
    }, 0);
    activeTableCellRef.current = null;
    setActiveTableContext(null);
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    updateToolbarState();
  };

  const handleRedo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1 || !editorRef.current) return;
    historyIndexRef.current += 1;
    const nextHtml = historyRef.current[historyIndexRef.current];
    editorRef.current.innerHTML = nextHtml;
    isInternalChangeRef.current = true;
    onChangeContent(nextHtml);
    window.setTimeout(() => {
      isInternalChangeRef.current = false;
    }, 0);
    activeTableCellRef.current = null;
    setActiveTableContext(null);
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    updateToolbarState();
  };

  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    const copyCodeBtn = target.closest('[data-action="copy-code"]');
    if (copyCodeBtn) {
      e.preventDefault();
      e.stopPropagation();
      const codeBlock = copyCodeBtn.closest('.note-code-block');
      const codeText =
        codeBlock?.querySelector('pre code')?.textContent ||
        codeBlock?.querySelector('pre')?.textContent ||
        '';
      if (!codeText.trim()) {
        showToast('Code block is empty');
        return;
      }
      navigator.clipboard
        ?.writeText(codeText)
        .then(() => showToast('Code copied'))
        .catch(() => showToast('Copy unavailable in this browser'));
      return;
    }

    const removeBtn = target.closest('[data-action="remove-image"]');
    if (removeBtn) {
      e.preventDefault();
      e.stopPropagation();
      const block = removeBtn.closest('.note-image-block');
      if (block) {
        block.remove();
        emitChange();
      }
      return;
    }

    const box = target.closest('.note-check-box') as HTMLElement | null;
    if (box) {
      e.preventDefault();
      const item = box.closest('.note-check-item') as HTMLElement | null;
      if (!item) return;
      const isChecked = item.getAttribute('data-checked') === 'true';
      item.setAttribute('data-checked', isChecked ? 'false' : 'true');
      box.setAttribute('aria-checked', isChecked ? 'false' : 'true');
      box.innerHTML = isChecked
        ? ''
        : '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      emitChange();
    } else {
      saveSelection();
      updateToolbarState();
    }
  };

  const toolbarBtnClass = (active = false, disabled = false) =>
    `relative min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
      disabled
        ? 'opacity-30 cursor-not-allowed text-[var(--text-secondary)]'
        : active
        ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
        : 'text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
    }`;

  const isToolbarVisible =
    isBodyFocused ||
    sizeSliderOpen ||
    colorBarOpen ||
    translateOpen ||
    insertMenuOpen ||
    Boolean(activeTableContext) ||
    isListening ||
    tableModalOpen ||
    linkModalOpen ||
    sketchOpen ||
    ocrSheetOpen;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={isPremium}
        className="hidden"
        onChange={(e) => {
          handleFilesSelected(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFilesSelected(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={ocrGalleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleOcrFileSelected(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={ocrCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void handleOcrFileSelected(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Distraction-free scrollable writing & inline media area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 pt-6 pb-8"
      >
        <input
          ref={titleInputRef}
          type="text"
          value={title}
          onChange={(e) => onChangeTitle(e.target.value)}
          onFocus={() => {
            if (blurTimeoutRef.current !== null) {
              window.clearTimeout(blurTimeoutRef.current);
              blurTimeoutRef.current = null;
            }
            setIsBodyFocused(false);
            activeTableCellRef.current = null;
            setActiveTableContext(null);
          }}
          placeholder="Note title"
          aria-label="Note title"
          className={`w-full bg-transparent text-[18px] sm:text-[20px] font-semibold tracking-[-0.01em] leading-snug text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/60 focus:outline-none ${
            isBodyFocused ? 'select-none' : ''
          }`}
        />

        <div className="my-4 h-px bg-[var(--divider)]" />

        <div ref={editorWrapperRef} className="relative">
          {dropIndicatorTop !== null && (
            <div
              aria-hidden="true"
              style={{ top: `${dropIndicatorTop}px` }}
              className="pointer-events-none select-none absolute left-0 right-0 z-30 flex items-center"
            >
              <span className="h-2.5 w-2.5 -ml-1 rounded-full bg-[var(--accent-primary)] shrink-0" />
              <span className="h-0.5 flex-1 bg-[var(--accent-primary)] rounded-full" />
              <span className="h-2.5 w-2.5 -mr-1 rounded-full bg-[var(--accent-primary)] shrink-0" />
            </div>
          )}

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Start writing..."
            onFocus={() => {
              if (blurTimeoutRef.current !== null) {
                window.clearTimeout(blurTimeoutRef.current);
                blurTimeoutRef.current = null;
              }
              setIsBodyFocused(true);
            }}
            onKeyDown={(e) => {
              const sel = window.getSelection();
              const anchorEl =
                sel?.anchorNode?.nodeType === Node.TEXT_NODE
                  ? sel.anchorNode.parentElement
                  : (sel?.anchorNode as HTMLElement | null);
              const inCodeBlock = Boolean(anchorEl?.closest('.note-code-block pre'));

              if (inCodeBlock && e.key === 'Enter') {
                e.preventDefault();
                document.execCommand('insertText', false, '\n');
                saveSelection();
                emitChange();
                return;
              }
              if (inCodeBlock && e.key === 'Tab') {
                e.preventDefault();
                document.execCommand('insertText', false, '  ');
                saveSelection();
                emitChange();
                return;
              }

              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                if (editorRef.current) {
                  const codeTarget = anchorEl?.closest('.note-code-block pre code');
                  if (sel) {
                    const range = document.createRange();
                    range.selectNodeContents(codeTarget || editorRef.current);
                    sel.removeAllRanges();
                    sel.addRange(range);
                    savedRangeRef.current = range.cloneRange();
                  }
                }
              }
            }}
            onInput={() => {
              saveSelection();
              emitChange();
            }}
            onKeyUp={() => {
              saveSelection();
              updateToolbarState();
            }}
            onMouseUp={() => {
              saveSelection();
              updateToolbarState();
            }}
            onTouchEnd={() => {
              saveSelection();
              updateToolbarState();
            }}
            onBlur={() => {
              saveSelection();
              if (blurTimeoutRef.current !== null) {
                window.clearTimeout(blurTimeoutRef.current);
              }
              blurTimeoutRef.current = window.setTimeout(() => {
                blurTimeoutRef.current = null;
                const activeEl = document.activeElement;
                if (
                  activeEl &&
                  (editorRef.current?.contains(activeEl) || toolbarRef.current?.contains(activeEl))
                ) {
                  return;
                }
                setIsBodyFocused(false);
              }, 180);
            }}
            onPointerDown={handleEditorPointerDown}
            onClick={handleEditorClick}
            onPaste={handlePaste}
            aria-label="Note content"
            className="note-content min-h-[260px] select-text text-[var(--text-primary)] focus:outline-none"
          />
        </div>

        {/* Legacy bottom attachments fallback (if any older note has note.images) */}
        {images.length > 0 && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 select-none">
            {images.map((src, idx) => (
              <div
                key={`${idx}_${src.slice(0, 32)}`}
                className="relative overflow-hidden rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)]"
              >
                <img
                  src={src}
                  alt={`Note attachment ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  className="w-full max-h-72 object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveLegacyImage(idx)}
                  aria-label="Remove image"
                  className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#202124]/80 text-white hover:bg-[#E45B5B] transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" strokeWidth={2.2} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Keyboard-Docked Formatting & Image Toolbar (shown only while writing/editing) */}
      {isToolbarVisible && (
        <div
          ref={toolbarRef}
          onPointerDownCapture={() => {
            if (blurTimeoutRef.current !== null) {
              window.clearTimeout(blurTimeoutRef.current);
              blurTimeoutRef.current = null;
            }
          }}
          className="shrink-0 relative z-30 select-none bg-[var(--bg-canvas)]/95 backdrop-blur-md border-t border-[var(--divider)] px-3 sm:px-6 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
        >
        {sizeSliderOpen && (
          <div className="mb-2 flex items-center gap-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] px-3.5 py-2">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)] shrink-0">
              Size
            </span>

            <div
              ref={sliderTrackRef}
              role="slider"
              aria-label="Selected text font size"
              aria-valuemin={MIN_TEXT_SIZE}
              aria-valuemax={MAX_TEXT_SIZE}
              aria-valuenow={activeFontSize}
              tabIndex={0}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                isSlidingRef.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                updateSliderFromClientX(e.clientX, false);
              }}
              onPointerMove={(e) => {
                if (!isSlidingRef.current) return;
                e.preventDefault();
                updateSliderFromClientX(e.clientX, false);
              }}
              onPointerUp={(e) => {
                if (!isSlidingRef.current) return;
                isSlidingRef.current = false;
                updateSliderFromClientX(e.clientX, true);
              }}
              onPointerCancel={() => {
                if (!isSlidingRef.current) return;
                isSlidingRef.current = false;
                emitChange();
              }}
              className="relative flex-1 h-8 flex items-center touch-none cursor-pointer select-none"
            >
              <div className="w-full h-1.5 rounded-full bg-[var(--divider)] overflow-hidden">
                <div
                  className="h-full bg-[var(--accent-primary)] rounded-full"
                  style={{
                    width: `${((activeFontSize - MIN_TEXT_SIZE) / (MAX_TEXT_SIZE - MIN_TEXT_SIZE)) * 100}%`,
                  }}
                />
              </div>
              <div
                style={{
                  left: `${((activeFontSize - MIN_TEXT_SIZE) / (MAX_TEXT_SIZE - MIN_TEXT_SIZE)) * 100}%`,
                }}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-[var(--accent-primary)] border-2 border-white dark:border-[#171717] shadow-sm pointer-events-none"
              />
            </div>

            <span className="min-w-[38px] text-right text-xs font-semibold tabular-nums text-[var(--text-primary)] shrink-0">
              {activeFontSize}px
            </span>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={closeSizeSlider}
              aria-label="Done resizing"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-primary)] hover:opacity-85 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
            </button>
          </div>
        )}

        {colorBarOpen && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] px-3 py-2">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="text-[11px] font-semibold text-[var(--text-secondary)] shrink-0">
                Color
              </span>
              {NOTE_TEXT_COLORS.map((c) => {
                const active = activeTextColor === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleApplyTextColor(c.id);
                    }}
                    aria-label={`${c.label} text color`}
                    title={c.label}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-transform active:scale-95 cursor-pointer ${
                      active
                        ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/30'
                        : 'border-[var(--divider)]'
                    }`}
                  >
                    {c.swatch ? (
                      <span
                        className="h-4.5 w-4.5 rounded-full"
                        style={{ backgroundColor: c.swatch }}
                      />
                    ) : (
                      <span className="h-4.5 w-4.5 rounded-full border border-[var(--text-secondary)]/60 bg-[var(--text-primary)]/15 flex items-center justify-center text-[9px] font-bold text-[var(--text-primary)]">
                        A
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={closeColorBar}
              aria-label="Done coloring"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-primary)] hover:opacity-85 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
            </button>
          </div>
        )}

        {translateOpen && (
          <div className="mb-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex items-center gap-2">
                <Languages className="h-4 w-4 text-[var(--accent-primary)] shrink-0" strokeWidth={2} />
                <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                  Translate: “{translateSourceText}”
                </span>
              </div>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={closeTranslateBar}
                aria-label="Close translate"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {TRANSLATE_LANGUAGES.map((lang) => {
                const busy = translatingLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    disabled={Boolean(translatingLang)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleRunTranslate(lang.code, lang.label)}
                    className="inline-flex min-h-[32px] items-center gap-1.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)]/70 disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    {busy && <Loader2 className="h-3 w-3 animate-spin text-[var(--accent-primary)]" />}
                    <span>{lang.nativeLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isListening && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-[var(--accent-soft)] px-3 py-1.5 text-xs">
            <span className="min-w-0 truncate font-medium text-[var(--text-primary)]">
              {interimTranscript
                ? interimTranscript
                : `Listening (${speechLang === 'bn-BD' ? 'বাংলা' : 'English'})… Speak now`}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleSwitchVoiceLanguage(speechLang === 'bn-BD' ? 'en-US' : 'bn-BD')}
                className="rounded-lg bg-[var(--bg-card)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-primary)] cursor-pointer"
              >
                {speechLang === 'bn-BD' ? 'বাংলা' : 'EN'}
              </button>
              <button
                type="button"
                onClick={() => handleToggleVoice()}
                className="font-semibold text-[#E45B5B] px-1 cursor-pointer"
              >
                Stop
              </button>
            </div>
          </div>
        )}

        {activeTableContext && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] px-2.5 py-1.5">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleTableAddRow();
                }}
                aria-label="Add row"
                className="inline-flex min-h-[32px] items-center gap-1 rounded-xl bg-[var(--bg-subtle)] px-2.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-primary)] transition-colors shrink-0 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
                <span>Row</span>
              </button>

              <button
                type="button"
                disabled={activeTableContext.isHeaderRow || activeTableContext.rowCount <= 1}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleTableDeleteRow();
                }}
                aria-label="Delete row"
                className="inline-flex min-h-[32px] items-center gap-1 rounded-xl bg-[var(--bg-subtle)] px-2.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[#E45B5B]/12 hover:text-[#E45B5B] disabled:opacity-35 disabled:cursor-not-allowed transition-colors shrink-0 cursor-pointer"
              >
                <Minus className="h-3.5 w-3.5" strokeWidth={2.2} />
                <span>Row</span>
              </button>

              <div className="mx-0.5 h-4 w-px bg-[var(--divider)] shrink-0" />

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleTableAddColumn();
                }}
                aria-label="Add column"
                className="inline-flex min-h-[32px] items-center gap-1 rounded-xl bg-[var(--bg-subtle)] px-2.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-primary)] transition-colors shrink-0 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
                <span>Col</span>
              </button>

              <button
                type="button"
                disabled={activeTableContext.colCount <= 1}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleTableDeleteColumn();
                }}
                aria-label="Delete column"
                className="inline-flex min-h-[32px] items-center gap-1 rounded-xl bg-[var(--bg-subtle)] px-2.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[#E45B5B]/12 hover:text-[#E45B5B] disabled:opacity-35 disabled:cursor-not-allowed transition-colors shrink-0 cursor-pointer"
              >
                <Minus className="h-3.5 w-3.5" strokeWidth={2.2} />
                <span>Col</span>
              </button>
            </div>

            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleTableDeleteWhole();
              }}
              aria-label="Delete table"
              title="Delete table"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#E45B5B]/10 text-[#E45B5B] hover:bg-[#E45B5B]/20 transition-colors cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-1">
          {(() => {
            const isFreeTool = (id: TextToolId) =>
              isToolEnabled(id) && !isToolPremium(id);

            const group1Visible =
              isFreeTool('bold') ||
              isFreeTool('italic') ||
              isFreeTool('underline') ||
              isFreeTool('strikethrough') ||
              isFreeTool('highlight') ||
              isFreeTool('text_color') ||
              isFreeTool('bullet_list') ||
              isFreeTool('numbered_list') ||
              isFreeTool('quote') ||
              isFreeTool('checklist');
            const group2Visible = isFreeTool('text_size');
            const group3Visible =
              isFreeTool('simple_table') ||
              isFreeTool('insert_link') ||
              isFreeTool('divider') ||
              isFreeTool('code_block') ||
              isFreeTool('quick_sketch');
            const group4Visible =
              isFreeTool('add_image') ||
              isFreeTool('take_photo') ||
              isFreeTool('ocr_scan') ||
              isFreeTool('voice_typing') ||
              isFreeTool('translate');

            const premiumMenuTools = TEXT_TOOLS_CATALOG.filter(
              (t) => isToolEnabled(t.id) && isToolPremium(t.id)
            );

            const renderToolIcon = (id: TextToolId, inMenu = false) => {
              const cls = inMenu ? 'h-4 w-4 text-[var(--text-secondary)] shrink-0' : 'h-4 w-4';
              switch (id) {
                case 'bold':
                  return <Bold className={cls} strokeWidth={2.2} />;
                case 'italic':
                  return <Italic className={cls} strokeWidth={2} />;
                case 'underline':
                  return <Underline className={cls} strokeWidth={2} />;
                case 'strikethrough':
                  return <Strikethrough className={cls} strokeWidth={2} />;
                case 'highlight':
                  return <Highlighter className={cls} strokeWidth={2} />;
                case 'text_color':
                  return <Palette className={cls} strokeWidth={2} />;
                case 'bullet_list':
                  return <List className={cls} strokeWidth={2} />;
                case 'text_size':
                  return <Heading2 className={cls} strokeWidth={2} />;
                case 'simple_table':
                  return <Table2 className={cls} strokeWidth={2} />;
                case 'insert_link':
                  return <Link2 className={cls} strokeWidth={2} />;
                case 'divider':
                  return <Minus className={cls} strokeWidth={2} />;
                case 'code_block':
                  return <Code2 className={cls} strokeWidth={2} />;
                case 'quick_sketch':
                  return <PenTool className={cls} strokeWidth={2} />;
                case 'add_image':
                  return <ImagePlus className={cls} strokeWidth={2} />;
                case 'take_photo':
                  return <Camera className={cls} strokeWidth={2} />;
                case 'ocr_scan':
                  return <ScanText className={cls} strokeWidth={2} />;
                case 'voice_typing':
                  return isListening ? (
                    <MicOff className="h-4 w-4 text-[#E45B5B] shrink-0" strokeWidth={2} />
                  ) : (
                    <Mic className={cls} strokeWidth={2} />
                  );
                case 'translate':
                  return <Languages className={cls} strokeWidth={2} />;
                case 'quote':
                  return <Quote className={cls} strokeWidth={1.85} />;
                case 'numbered_list':
                  return <ListOrdered className={cls} strokeWidth={1.85} />;
                case 'checklist':
                  return <CheckSquare className={cls} strokeWidth={1.85} />;
              }
            };

            const triggerMenuTool = (meta: TextToolMeta) => {
              setInsertMenuOpen(false);
              runToolAction(meta.id, meta.upgradeTitle, () => {
                switch (meta.id) {
                  case 'bold':
                    restoreSavedRange();
                    handleFormat('bold');
                    break;
                  case 'italic':
                    restoreSavedRange();
                    handleFormat('italic');
                    break;
                  case 'underline':
                    restoreSavedRange();
                    handleFormat('underline');
                    break;
                  case 'strikethrough':
                    restoreSavedRange();
                    handleFormat('strikeThrough');
                    break;
                  case 'highlight':
                    restoreSavedRange();
                    handleToggleHighlight();
                    break;
                  case 'text_color':
                    handleOpenColorBar();
                    break;
                  case 'bullet_list':
                    restoreSavedRange();
                    handleFormat('insertUnorderedList');
                    break;
                  case 'text_size':
                    handleOpenTextSizeSlider();
                    break;
                  case 'simple_table':
                    handleOpenTableModal();
                    break;
                  case 'insert_link':
                    handleOpenLinkModal();
                    break;
                  case 'divider':
                    handleInsertDivider();
                    break;
                  case 'code_block':
                    handleInsertCodeBlock();
                    break;
                  case 'quick_sketch':
                    handleOpenSketch();
                    break;
                  case 'add_image':
                    handleImageTrigger('gallery');
                    break;
                  case 'take_photo':
                    handleImageTrigger('camera');
                    break;
                  case 'ocr_scan':
                    handleOpenOcrScanner();
                    break;
                  case 'voice_typing':
                    void handleToggleVoice();
                    break;
                  case 'translate':
                    handleOpenTranslateBar();
                    break;
                  case 'quote':
                    restoreSavedRange();
                    handleToggleBlockquote();
                    break;
                  case 'numbered_list':
                    restoreSavedRange();
                    handleFormat('insertOrderedList');
                    break;
                  case 'checklist':
                    restoreSavedRange();
                    handleInsertChecklist();
                    break;
                }
              });
            };

            return (
              <>
                <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto no-scrollbar min-w-0">
                  {isFreeTool('bold') && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        runToolAction('bold', 'Bold formatting', () => handleFormat('bold'));
                      }}
                      aria-label="Bold"
                      title="Bold"
                      className={toolbarBtnClass(activeFormats.bold)}
                    >
                      <Bold className="h-4 w-4" strokeWidth={2.2} />
                    </button>
                  )}

                  {isFreeTool('italic') && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        runToolAction('italic', 'Italic formatting', () => handleFormat('italic'));
                      }}
                      aria-label="Italic"
                      title="Italic"
                      className={toolbarBtnClass(activeFormats.italic)}
                    >
                      <Italic className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}

                  {isFreeTool('underline') && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        runToolAction('underline', 'Underline formatting', () =>
                          handleFormat('underline')
                        );
                      }}
                      aria-label="Underline"
                      title="Underline"
                      className={toolbarBtnClass(activeFormats.underline)}
                    >
                      <Underline className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}

                  {isFreeTool('strikethrough') && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        runToolAction('strikethrough', 'Strikethrough formatting', () =>
                          handleFormat('strikeThrough')
                        );
                      }}
                      aria-label="Strikethrough"
                      title="Strikethrough"
                      className={toolbarBtnClass(activeFormats.strikeThrough)}
                    >
                      <Strikethrough className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}

                  {isFreeTool('highlight') && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        runToolAction('highlight', 'Text highlight', handleToggleHighlight);
                      }}
                      aria-label="Highlight text"
                      title="Highlight"
                      className={toolbarBtnClass(false)}
                    >
                      <Highlighter className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}

                  {isFreeTool('text_color') && (
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        runToolAction('text_color', 'Text color', handleOpenColorBar);
                      }}
                      aria-label="Text color"
                      title="Text color"
                      className={toolbarBtnClass(colorBarOpen)}
                    >
                      <Palette className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}

                  {isFreeTool('bullet_list') && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        runToolAction('bullet_list', 'Bullet lists', () =>
                          handleFormat('insertUnorderedList')
                        );
                      }}
                      aria-label="Bullet list"
                      title="Bullet list"
                      className={toolbarBtnClass(activeFormats.unorderedList)}
                    >
                      <List className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}

                  {isFreeTool('numbered_list') && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        runToolAction('numbered_list', 'Numbered lists', () =>
                          handleFormat('insertOrderedList')
                        );
                      }}
                      aria-label="Numbered list"
                      title="Numbered List"
                      className={toolbarBtnClass(activeFormats.orderedList)}
                    >
                      <ListOrdered className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}

                  {isFreeTool('quote') && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        runToolAction('quote', 'Quote blocks', handleToggleBlockquote);
                      }}
                      aria-label="Quote"
                      title="Quote"
                      className={toolbarBtnClass(false)}
                    >
                      <Quote className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}

                  {isFreeTool('checklist') && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        runToolAction('checklist', 'Interactive checklists', handleInsertChecklist);
                      }}
                      aria-label="Checklist"
                      title="Checklist"
                      className={toolbarBtnClass(false)}
                    >
                      <CheckSquare className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}

                  {group1Visible && (group2Visible || group3Visible || group4Visible) && (
                    <div className="mx-1 h-4 w-px bg-[var(--divider)] shrink-0" />
                  )}

                  {isFreeTool('text_size') && (
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        runToolAction('text_size', 'Text resizing', handleOpenTextSizeSlider);
                      }}
                      aria-label="Resize selected text"
                      title="Resize selected text"
                      className={toolbarBtnClass(sizeSliderOpen)}
                    >
                      <Heading2 className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}

                  {group2Visible && (group3Visible || group4Visible) && (
                    <div className="mx-1 h-4 w-px bg-[var(--divider)] shrink-0" />
                  )}

                  {isFreeTool('simple_table') && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        saveSelection();
                      }}
                      onTouchStart={() => saveSelection()}
                      onClick={() =>
                        runToolAction('simple_table', 'Simple tables', handleOpenTableModal)
                      }
                      aria-label="Simple Table"
                      title="Simple Table"
                      className={toolbarBtnClass(tableModalOpen)}
                    >
                      <Table2 className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}

                  {isFreeTool('insert_link') && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        saveSelection();
                      }}
                      onTouchStart={() => saveSelection()}
                      onClick={() =>
                        runToolAction('insert_link', 'Link insertion', handleOpenLinkModal)
                      }
                      aria-label="Insert Link"
                      title="Insert Link"
                      className={toolbarBtnClass(linkModalOpen)}
                    >
                      <Link2 className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}

                  {isFreeTool('divider') && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        saveSelection();
                        runToolAction('divider', 'Divider lines', handleInsertDivider);
                      }}
                      aria-label="Divider Line"
                      title="Divider Line"
                      className={toolbarBtnClass(false)}
                    >
                      <Minus className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}

                  {isFreeTool('code_block') && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        saveSelection();
                        runToolAction('code_block', 'Code blocks', handleInsertCodeBlock);
                      }}
                      aria-label="Code Block"
                      title="Code Block"
                      className={toolbarBtnClass(false)}
                    >
                      <Code2 className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}

                  {isFreeTool('quick_sketch') && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        saveSelection();
                      }}
                      onTouchStart={() => saveSelection()}
                      onClick={() =>
                        runToolAction('quick_sketch', 'Quick Sketch', handleOpenSketch)
                      }
                      aria-label="Quick Sketch"
                      title="Quick Sketch"
                      className={toolbarBtnClass(sketchOpen)}
                    >
                      <PenTool className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}

                  {group3Visible && group4Visible && (
                    <div className="mx-1 h-4 w-px bg-[var(--divider)] shrink-0" />
                  )}

                  {isFreeTool('add_image') && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        saveSelection();
                      }}
                      onTouchStart={() => saveSelection()}
                      onClick={() =>
                        runToolAction('add_image', 'Gallery images', () =>
                          handleImageTrigger('gallery')
                        )
                      }
                      aria-label="Add image"
                      title="Add image at cursor"
                      className={toolbarBtnClass(false)}
                    >
                      <ImagePlus className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}

                  {isFreeTool('take_photo') && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        saveSelection();
                      }}
                      onTouchStart={() => saveSelection()}
                      onClick={() =>
                        runToolAction('take_photo', 'Camera photos', () =>
                          handleImageTrigger('camera')
                        )
                      }
                      aria-label="Take photo"
                      title="Take photo at cursor"
                      className={toolbarBtnClass(false)}
                    >
                      <Camera className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}

                  {isFreeTool('ocr_scan') && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        saveSelection();
                      }}
                      onTouchStart={() => saveSelection()}
                      onClick={() =>
                        runToolAction('ocr_scan', 'Image to Text (OCR)', handleOpenOcrScanner)
                      }
                      aria-label="Scan Text (OCR)"
                      title="Scan Text (OCR)"
                      className={toolbarBtnClass(ocrSheetOpen)}
                    >
                      <ScanText className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}

                  {isFreeTool('voice_typing') && (
                    <>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          saveSelection();
                        }}
                        onTouchStart={() => saveSelection()}
                        onClick={() =>
                          runToolAction('voice_typing', 'Voice typing', () => handleToggleVoice())
                        }
                        aria-label={isListening ? 'Stop voice typing' : 'Voice typing'}
                        title={
                          isListening
                            ? 'Stop listening'
                            : `Voice typing (${speechLang === 'bn-BD' ? 'বাংলা' : 'EN'})`
                        }
                        className={toolbarBtnClass(isListening)}
                      >
                        {isListening ? (
                          <MicOff className="h-4 w-4 text-[#E45B5B]" strokeWidth={2} />
                        ) : (
                          <Mic className="h-4 w-4" strokeWidth={2} />
                        )}
                      </button>

                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() =>
                          handleSwitchVoiceLanguage(speechLang === 'bn-BD' ? 'en-US' : 'bn-BD')
                        }
                        aria-label="Switch voice language"
                        title="Switch voice language"
                        className="h-9 px-2 rounded-xl flex items-center justify-center text-[11px] font-semibold text-[var(--accent-primary)] hover:bg-[var(--bg-subtle)] shrink-0 cursor-pointer"
                      >
                        {speechLang === 'bn-BD' ? 'বাংলা' : 'EN'}
                      </button>
                    </>
                  )}

                  {isFreeTool('translate') && (
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        runToolAction('translate', 'Text translation', handleOpenTranslateBar);
                      }}
                      aria-label="Translate selected text"
                      title="Translate selected text"
                      className={toolbarBtnClass(translateOpen)}
                    >
                      <Languages className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                  {/* + Premium Text Tools Menu (only rendered when at least 1 enabled tool is Premium) */}
                  {premiumMenuTools.length > 0 && (
                    <div className="relative" ref={insertMenuRef}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          saveSelection();
                        }}
                        onTouchStart={() => saveSelection()}
                        onClick={() => setInsertMenuOpen((v) => !v)}
                        aria-label="Premium text tools"
                        title="Premium text tools"
                        className={toolbarBtnClass(insertMenuOpen)}
                      >
                        <Plus className="h-4 w-4" strokeWidth={2.2} />
                      </button>

                      {insertMenuOpen && (
                        <div className="absolute right-0 bottom-full mb-2 w-60 max-h-72 overflow-y-auto rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] py-1.5 z-40 shadow-lg">
                          {premiumMenuTools.map((meta) => {
                            const useClickTrigger =
                              meta.id === 'simple_table' ||
                              meta.id === 'insert_link' ||
                              meta.id === 'quick_sketch' ||
                              meta.id === 'add_image' ||
                              meta.id === 'take_photo' ||
                              meta.id === 'ocr_scan' ||
                              meta.id === 'voice_typing';

                            return (
                              <div
                                key={meta.id}
                                className="flex items-center justify-between gap-1 px-1"
                              >
                                <button
                                  type="button"
                                  onMouseDown={(e) => {
                                    if (!useClickTrigger) {
                                      e.preventDefault();
                                      triggerMenuTool(meta);
                                    }
                                  }}
                                  onClick={() => {
                                    if (useClickTrigger) {
                                      triggerMenuTool(meta);
                                    }
                                  }}
                                  className="flex flex-1 min-h-[42px] items-center justify-between gap-2.5 rounded-xl px-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                                >
                                  <span className="flex items-center gap-2.5 min-w-0">
                                    {renderToolIcon(meta.id, true)}
                                    <span className="truncate">{meta.label}</span>
                                  </span>
                                  {!isPremium && (
                                    <Lock className="h-3.5 w-3.5 text-[var(--accent-primary)] shrink-0" />
                                  )}
                                </button>

                                {meta.id === 'voice_typing' && isPremium && (
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() =>
                                      handleSwitchVoiceLanguage(
                                        speechLang === 'bn-BD' ? 'en-US' : 'bn-BD'
                                      )
                                    }
                                    className="mr-1.5 px-2 py-1 rounded-lg bg-[var(--bg-subtle)] text-[11px] font-semibold text-[var(--accent-primary)] shrink-0 cursor-pointer"
                                  >
                                    {speechLang === 'bn-BD' ? 'বাংলা' : 'EN'}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleUndo();
                    }}
                    disabled={!canUndo}
                    aria-label="Undo"
                    title="Undo"
                    className={toolbarBtnClass(false, !canUndo)}
                  >
                    <Undo2 className="h-4 w-4" strokeWidth={2} />
                  </button>

                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleRedo();
                    }}
                    disabled={!canRedo}
                    aria-label="Redo"
                    title="Redo"
                    className={toolbarBtnClass(false, !canRedo)}
                  >
                    <Redo2 className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              </>
            );
          })()}
        </div>
        </div>
      )}

      {/* Floating thumbnail ghost while dragging an inline image */}
      {dragGhost && (
        <div
          aria-hidden="true"
          style={{
            left: `${dragGhost.x}px`,
            top: `${dragGhost.y}px`,
            transform: 'translate(-50%, -65%)',
          }}
          className="pointer-events-none fixed z-50 h-20 w-28 overflow-hidden rounded-xl border-2 border-[var(--accent-primary)] bg-[var(--bg-card)] opacity-90"
        >
          <img
            src={dragGhost.src}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* Insert Table Modal */}
      {tableModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setTableModalOpen(false)}
        >
          <form
            onSubmit={handleConfirmTable}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[var(--bg-card)] border border-[var(--divider)] p-6 space-y-3"
          >
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Simple Table</h3>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                autoFocus
                value={tableColsInput}
                onChange={(e) => setTableColsInput(e.target.value)}
                placeholder="Columns"
                aria-label="Columns"
                className="w-full min-h-[44px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={tableRowsInput}
                onChange={(e) => setTableRowsInput(e.target.value)}
                placeholder="Rows"
                aria-label="Rows"
                className="w-full min-h-[44px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
            <div className="pt-2 flex gap-2.5">
              <button
                type="button"
                onClick={() => setTableModalOpen(false)}
                className="flex-1 min-h-[44px] rounded-full bg-[var(--bg-subtle)] text-sm font-semibold text-[var(--text-primary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  !(parseInt(tableColsInput, 10) >= 1) ||
                  !(parseInt(tableRowsInput, 10) >= 1)
                }
                className="flex-1 min-h-[44px] rounded-full bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] disabled:opacity-40 cursor-pointer"
              >
                Insert
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Insert Link Modal */}
      {linkModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLinkModalOpen(false)}
        >
          <form
            onSubmit={handleConfirmLink}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[var(--bg-card)] border border-[var(--divider)] p-6 space-y-3"
          >
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Insert Link</h3>
            <input
              type="text"
              autoFocus
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Paste URL (https://...)"
              aria-label="Link URL"
              className="w-full min-h-[44px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
            <input
              type="text"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              placeholder="Display text (optional)"
              aria-label="Link text"
              className="w-full min-h-[44px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
            <div className="pt-2 flex gap-2.5">
              <button
                type="button"
                onClick={() => setLinkModalOpen(false)}
                className="flex-1 min-h-[44px] rounded-full bg-[var(--bg-subtle)] text-sm font-semibold text-[var(--text-primary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!linkUrl.trim()}
                className="flex-1 min-h-[44px] rounded-full bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] disabled:opacity-40 cursor-pointer"
              >
                Insert
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick Sketch Modal */}
      <SketchModal
        open={sketchOpen}
        onInsert={(dataUrl) => insertImageBlocksAtSavedRange([dataUrl])}
        onClose={() => setSketchOpen(false)}
      />

      {/* Image-to-Text (OCR) Sheet */}
      {ocrSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!ocrScanning) setOcrSheetOpen(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl bg-[var(--bg-card)] border border-[var(--divider)] p-6 space-y-4"
          >
            <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-[var(--divider)] sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Scan Text (OCR)
              </h3>
              {!ocrScanning && (
                <button
                  type="button"
                  onClick={() => setOcrSheetOpen(false)}
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {ocrScanning ? (
              <div className="py-6 flex flex-col items-center text-center gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-[var(--accent-primary)]" />
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Scanning text from image...
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => ocrCameraInputRef.current?.click()}
                  className="flex w-full min-h-[46px] items-center justify-center gap-2.5 rounded-xl bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] cursor-pointer"
                >
                  <Camera className="h-4 w-4" strokeWidth={2} />
                  <span>Take Photo (Camera)</span>
                </button>

                <button
                  type="button"
                  onClick={() => ocrGalleryInputRef.current?.click()}
                  className="flex w-full min-h-[46px] items-center justify-center gap-2.5 rounded-xl bg-[var(--bg-subtle)] text-sm font-semibold text-[var(--text-primary)] cursor-pointer"
                >
                  <ImagePlus className="h-4 w-4" strokeWidth={2} />
                  <span>Choose from Gallery</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
