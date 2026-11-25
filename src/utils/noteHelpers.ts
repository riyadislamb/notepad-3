import { TrashRetentionConfig } from '../types/notes';

export function stripHtmlToText(html: string): string {
  if (!html) return '';
  if (typeof window === 'undefined') {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const container = document.createElement('div');
  container.innerHTML = html;
  // Remove non-content image/code controls before extracting text
  container.querySelectorAll('.note-image-controls, .note-code-header').forEach((el) => el.remove());
  const blocks = container.querySelectorAll('p, li, div, h2, blockquote, pre');
  blocks.forEach((el) => {
    el.appendChild(document.createTextNode(' '));
  });
  return (container.textContent || container.innerText || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractNoteImages(html: string, legacyImages?: string[]): string[] {
  const result: string[] = [];
  if (html && typeof window !== 'undefined') {
    const container = document.createElement('div');
    container.innerHTML = html;
    container.querySelectorAll('.note-image-block img, img').forEach((img) => {
      const src = img.getAttribute('src');
      if (src && !result.includes(src)) {
        result.push(src);
      }
    });
  }
  if (Array.isArray(legacyImages)) {
    legacyImages.forEach((src) => {
      if (src && !result.includes(src)) {
        result.push(src);
      }
    });
  }
  return result;
}

export function getNotePreview(html: string, maxLength = 120): string {
  const plain = stripHtmlToText(html);
  if (!plain) return 'No additional text';
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength).trimEnd()}…`;
}

export function formatNoteDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfTarget.getTime()) / (1000 * 60 * 60 * 24)
  );

  const timeStr = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (diffDays === 0) {
    return `Today · ${timeStr}`;
  }
  if (diffDays === 1) {
    return `Yesterday · ${timeStr}`;
  }
  if (diffDays > 1 && diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function formatFullDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return (
    date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) +
    ' · ' +
    date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  );
}

export function countWords(html: string): number {
  const text = stripHtmlToText(html);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function toggleChecklistItemInHtml(html: string, index: number): string {
  if (typeof window === 'undefined') return html;
  const container = document.createElement('div');
  container.innerHTML = html;
  const items = container.querySelectorAll('.note-check-item');
  const target = items[index];
  if (!target) return html;

  const isChecked = target.getAttribute('data-checked') === 'true';
  target.setAttribute('data-checked', isChecked ? 'false' : 'true');
  const box = target.querySelector('.note-check-box');
  if (box) {
    box.setAttribute('aria-checked', isChecked ? 'false' : 'true');
    box.innerHTML = isChecked
      ? ''
      : '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  }
  return container.innerHTML;
}

export function readAndCompressImage(file: File, maxWidth = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        if (img.width <= maxWidth) {
          resolve(dataUrl);
          return;
        }
        const scale = maxWidth / img.width;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function isIntentionalHighlightBg(raw: string): boolean {
  const normalized = raw.replace(/\s+/g, '').toLowerCase();
  return (
    normalized === '#fff1b8' ||
    normalized === 'rgb(255,241,184)' ||
    normalized === 'rgba(255,241,184,1)'
  );
}

export function sanitizeNoteThemeElements(root: HTMLElement): void {
  const elements = root.querySelectorAll<HTMLElement>('*');
  elements.forEach((el) => {
    if (
      el.closest('.note-image-controls') ||
      el.closest('.note-check-box') ||
      el.closest('.note-code-header') ||
      el.classList.contains('note-image-controls') ||
      el.classList.contains('note-check-box') ||
      el.classList.contains('note-code-header')
    ) {
      return;
    }

    const bgColor = el.style.backgroundColor || '';
    const bgShorthand = el.style.background || '';
    const markedHighlight = el.getAttribute('data-note-highlight') === 'true';

    if (isIntentionalHighlightBg(bgColor) || (markedHighlight && !bgColor)) {
      if (isIntentionalHighlightBg(bgColor)) {
        el.setAttribute('data-note-highlight', 'true');
        el.style.backgroundColor = '#FFF1B8';
        el.style.color = '#202124';
      } else {
        el.removeAttribute('data-note-highlight');
      }
    } else {
      if (markedHighlight) {
        el.removeAttribute('data-note-highlight');
      }
      if (bgColor) {
        el.style.removeProperty('background-color');
      }
      if (bgShorthand) {
        el.style.removeProperty('background');
      }
      if (el.hasAttribute('bgcolor')) {
        el.removeAttribute('bgcolor');
      }
    }

    const noteColor = el.getAttribute('data-note-color');
    const validNoteColor =
      noteColor === 'red' ||
      noteColor === 'orange' ||
      noteColor === 'green' ||
      noteColor === 'blue' ||
      noteColor === 'purple' ||
      noteColor === 'gray';
    if (noteColor && !validNoteColor) {
      el.removeAttribute('data-note-color');
    }

    if (el.getAttribute('data-note-highlight') !== 'true') {
      if (el.style.color && el.tagName !== 'A') {
        el.style.removeProperty('color');
      }
      if (el.hasAttribute('color')) {
        el.removeAttribute('color');
      }
    }

    if (el.hasAttribute('style') && el.getAttribute('style')?.trim() === '') {
      el.removeAttribute('style');
    }
  });
}

export function sanitizeNoteThemeHtml(html: string): string {
  if (!html || typeof window === 'undefined') return html;
  const container = document.createElement('div');
  container.innerHTML = html;
  container.querySelectorAll('script, style, meta, link').forEach((node) => node.remove());
  sanitizeNoteThemeElements(container);
  return container.innerHTML;
}

export const TRASH_RETENTION_DAYS = 30;
export const DEFAULT_TRASH_RETENTION: TrashRetentionConfig = {
  enabled: true,
  months: 0,
  days: TRASH_RETENTION_DAYS,
};

export function normalizeTrashRetention(
  raw?: Partial<TrashRetentionConfig> | null
): TrashRetentionConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_TRASH_RETENTION };
  }
  const months = Math.max(0, Math.min(120, Math.floor(Number(raw.months) || 0)));
  const days = Math.max(0, Math.min(365, Math.floor(Number(raw.days) || 0)));
  const enabled = raw.enabled !== false && (months > 0 || days > 0);
  return {
    enabled,
    months,
    days,
  };
}

export function formatTrashRetentionDuration(
  retention: TrashRetentionConfig = DEFAULT_TRASH_RETENTION,
  compact = false
): string {
  if (!retention.enabled || (retention.months <= 0 && retention.days <= 0)) {
    return 'Off';
  }
  const parts: string[] = [];
  if (retention.months > 0) {
    parts.push(
      compact
        ? `${retention.months}m`
        : `${retention.months} ${retention.months === 1 ? 'month' : 'months'}`
    );
  }
  if (retention.days > 0) {
    parts.push(
      compact
        ? `${retention.days}d`
        : `${retention.days} ${retention.days === 1 ? 'day' : 'days'}`
    );
  }
  return parts.join(' ');
}

export function computeTrashExpiryMs(
  deletedAt: string,
  retention: TrashRetentionConfig = DEFAULT_TRASH_RETENTION
): number | null {
  if (!retention.enabled || (retention.months <= 0 && retention.days <= 0)) {
    return null;
  }
  const deletedDate = new Date(deletedAt);
  if (Number.isNaN(deletedDate.getTime())) return null;
  const expiry = new Date(deletedDate.getTime());
  if (retention.months > 0) {
    expiry.setMonth(expiry.getMonth() + retention.months);
  }
  if (retention.days > 0) {
    expiry.setDate(expiry.getDate() + retention.days);
  }
  return expiry.getTime();
}

export function isTrashExpired(
  deletedAt?: string,
  nowMs = Date.now(),
  retention: TrashRetentionConfig = DEFAULT_TRASH_RETENTION
): boolean {
  if (!deletedAt) return false;
  const expiryMs = computeTrashExpiryMs(deletedAt, retention);
  if (expiryMs === null) return false;
  return nowMs >= expiryMs;
}

export function getTrashDaysRemaining(
  deletedAt?: string,
  nowMs = Date.now(),
  retention: TrashRetentionConfig = DEFAULT_TRASH_RETENTION
): number | null {
  if (!retention.enabled || (retention.months <= 0 && retention.days <= 0)) {
    return null;
  }
  if (!deletedAt) {
    const fallbackExpiry = computeTrashExpiryMs(new Date(nowMs).toISOString(), retention);
    if (fallbackExpiry === null) return TRASH_RETENTION_DAYS;
    return Math.max(1, Math.ceil((fallbackExpiry - nowMs) / (24 * 60 * 60 * 1000)));
  }
  const expiryMs = computeTrashExpiryMs(deletedAt, retention);
  if (expiryMs === null) return null;
  const remainingMs = expiryMs - nowMs;
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}

export function formatTrashRemainingLabel(
  deletedAt?: string,
  nowMs = Date.now(),
  retention: TrashRetentionConfig = DEFAULT_TRASH_RETENTION
): string {
  if (!retention.enabled || (retention.months <= 0 && retention.days <= 0)) {
    return 'Auto-delete off';
  }
  if (!deletedAt) {
    return `${formatTrashRetentionDuration(retention)} left`;
  }
  const expiryMs = computeTrashExpiryMs(deletedAt, retention);
  if (expiryMs === null) {
    return `${formatTrashRetentionDuration(retention)} left`;
  }
  const remainingMs = expiryMs - nowMs;
  if (remainingMs <= 0) return 'Expiring soon';
  if (remainingMs < 24 * 60 * 60 * 1000) return 'Expires today';
  const days = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  return `${days} ${days === 1 ? 'day' : 'days'} left`;
}

export function getEditableTextNodes(root: HTMLElement): Text[] {
  if (typeof document === 'undefined') return [];
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let current = walker.nextNode();
  while (current) {
    const parentEl = current.parentElement;
    if (
      !parentEl?.closest(
        '.note-image-controls, .note-code-header, .note-check-box, [data-image-block="true"]'
      )
    ) {
      nodes.push(current as Text);
    }
    current = walker.nextNode();
  }
  return nodes;
}

export function getCaretRangeFromPoint(clientX: number, clientY: number): Range | null {
  if (typeof document === 'undefined') return null;
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (
      x: number,
      y: number
    ) => { offsetNode: Node; offset: number } | null;
  };
  if (typeof doc.caretRangeFromPoint === 'function') {
    try {
      const r = doc.caretRangeFromPoint(clientX, clientY);
      if (r) return r;
    } catch {
      // Ignore browser-specific errors
    }
  }
  if (typeof doc.caretPositionFromPoint === 'function') {
    try {
      const pos = doc.caretPositionFromPoint(clientX, clientY);
      if (pos && pos.offsetNode) {
        const range = document.createRange();
        const maxOffset =
          pos.offsetNode.nodeType === Node.TEXT_NODE
            ? (pos.offsetNode.textContent?.length ?? 0)
            : pos.offsetNode.childNodes.length;
        range.setStart(pos.offsetNode, Math.min(pos.offset, maxOffset));
        range.collapse(true);
        return range;
      }
    } catch {
      // Ignore browser-specific errors
    }
  }
  return null;
}

export function getCharOffsetInRootFromRange(root: HTMLElement, range: Range): number | null {
  if (!root.contains(range.startContainer)) return null;
  const textNodes = getEditableTextNodes(root);
  if (textNodes.length === 0) return null;

  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    let offset = 0;
    for (const node of textNodes) {
      if (node === range.startContainer) {
        return offset + Math.min(range.startOffset, node.length);
      }
      offset += node.length;
    }
    return null;
  }

  const targetRange = document.createRange();
  targetRange.setStart(range.startContainer, range.startOffset);
  targetRange.collapse(true);

  let offset = 0;
  for (const node of textNodes) {
    const nodeRange = document.createRange();
    nodeRange.selectNodeContents(node);
    const cmp = nodeRange.compareBoundaryPoints(Range.START_TO_START, targetRange);
    if (cmp >= 0) {
      break;
    }
    offset += node.length;
  }
  return offset;
}

export function placeCaretAtCharOffset(root: HTMLElement, offset: number): Range | null {
  if (typeof window === 'undefined') return null;
  const textNodes = getEditableTextNodes(root);
  const range = document.createRange();

  if (textNodes.length === 0) {
    range.selectNodeContents(root);
    range.collapse(false);
  } else {
    let remaining = Math.max(0, offset);
    let placed = false;
    for (const node of textNodes) {
      if (remaining <= node.length) {
        range.setStart(node, remaining);
        range.collapse(true);
        placed = true;
        break;
      }
      remaining -= node.length;
    }
    if (!placed) {
      const last = textNodes[textNodes.length - 1];
      range.setStart(last, last.length);
      range.collapse(true);
    }
  }

  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(range);
  }
  return range;
}

export function placeCaretAtEnd(root: HTMLElement): Range | null {
  if (typeof window === 'undefined') return null;
  const textNodes = getEditableTextNodes(root);
  const range = document.createRange();

  if (textNodes.length === 0) {
    range.selectNodeContents(root);
    range.collapse(false);
  } else {
    const lastText = textNodes[textNodes.length - 1];
    const lastBlock = root.lastElementChild;
    const isTrailingNonTextBlock =
      lastBlock &&
      lastBlock.matches('.note-image-block, hr, table') &&
      !lastBlock.contains(lastText);

    if (isTrailingNonTextBlock) {
      range.selectNodeContents(root);
      range.collapse(false);
    } else {
      range.setStart(lastText, lastText.length);
      range.collapse(true);
    }
  }

  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(range);
  }
  return range;
}
