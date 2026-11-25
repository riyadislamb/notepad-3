import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { Folder, Note } from '../types/notes';
import { extractNoteImages, formatFullDate, stripHtmlToText } from './noteHelpers';

interface ParsedPdfBlock {
  type: 'heading' | 'paragraph' | 'bullet' | 'numbered' | 'checklist' | 'quote' | 'code' | 'divider' | 'image' | 'table';
  text?: string;
  checked?: boolean;
  index?: number;
  src?: string;
  rows?: { cells: string[]; isHeader: boolean }[];
}

function sanitizeFileName(raw: string, fallback: string): string {
  const cleaned = raw
    .replace(/[/\\:*?"<>|\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 72);
  return cleaned || fallback;
}

function createUniqueFileName(baseName: string, ext: string, used: Set<string>): string {
  let candidate = `${baseName}.${ext}`;
  let counter = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${baseName} (${counter}).${ext}`;
    counter += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function htmlToStructuredText(html: string): string {
  if (!html) return '';
  if (typeof window === 'undefined') {
    return stripHtmlToText(html);
  }

  const container = document.createElement('div');
  container.innerHTML = html;

  const lines: string[] = [];
  let orderedCounter = 1;

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').replace(/\u00a0/g, ' ').trim();
      if (text) lines.push(text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (
      el.classList.contains('note-image-controls') ||
      el.classList.contains('note-image-block') ||
      el.classList.contains('note-code-header')
    ) {
      return;
    }

    if (el.classList.contains('note-code-block')) {
      const codeText = (
        el.querySelector('pre code')?.textContent ||
        el.querySelector('pre')?.textContent ||
        ''
      ).trim();
      if (codeText) lines.push(codeText);
      return;
    }

    if (el.classList.contains('note-check-item')) {
      const checked = el.getAttribute('data-checked') === 'true';
      const textEl = el.querySelector('.note-check-text');
      const text = (textEl ? textEl.textContent : el.textContent || '').trim();
      if (text) lines.push(`${checked ? '[x]' : '[ ]'} ${text}`);
      return;
    }

    if (tag === 'hr') {
      lines.push('--------------------');
      return;
    }

    if (tag === 'ul') {
      Array.from(el.children).forEach((li) => {
        const text = (li.textContent || '').trim();
        if (text) lines.push(`• ${text}`);
      });
      return;
    }

    if (tag === 'ol') {
      orderedCounter = 1;
      Array.from(el.children).forEach((li) => {
        const text = (li.textContent || '').trim();
        if (text) {
          lines.push(`${orderedCounter}. ${text}`);
          orderedCounter += 1;
        }
      });
      return;
    }

    if (tag === 'blockquote') {
      const text = (el.textContent || '').trim();
      if (text) lines.push(`> ${text}`);
      return;
    }

    if (tag === 'table') {
      Array.from(el.querySelectorAll('tr')).forEach((tr) => {
        const cells = Array.from(tr.querySelectorAll('th, td'))
          .map((c) => (c.textContent || '').trim())
          .join(' | ');
        if (cells.trim()) lines.push(cells);
      });
      return;
    }

    if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'li'].includes(tag)) {
      const hasBlockChildren = Array.from(el.children).some((child) =>
        [
          'p',
          'div',
          'ul',
          'ol',
          'blockquote',
          'table',
          'hr',
          'h1',
          'h2',
          'h3',
          'h4',
        ].includes(child.tagName.toLowerCase()) ||
        child.classList.contains('note-check-item') ||
        child.classList.contains('note-image-block')
      );
      if (hasBlockChildren) {
        Array.from(el.childNodes).forEach(walk);
      } else {
        const text = (el.textContent || '').replace(/\u00a0/g, ' ').trim();
        if (text) lines.push(text);
      }
      return;
    }

    Array.from(el.childNodes).forEach(walk);
  };

  Array.from(container.childNodes).forEach(walk);
  return lines.join('\n').trim();
}

function parseHtmlToPdfBlocks(note: Note): ParsedPdfBlock[] {
  const blocks: ParsedPdfBlock[] = [];
  if (typeof window === 'undefined') {
    const plain = stripHtmlToText(note.content);
    if (plain) blocks.push({ type: 'paragraph', text: plain });
    return blocks;
  }

  const container = document.createElement('div');
  container.innerHTML = note.content || '';

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').replace(/\u00a0/g, ' ').trim();
      if (text) blocks.push({ type: 'paragraph', text });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (el.classList.contains('note-image-controls') || el.classList.contains('note-code-header')) {
      return;
    }

    if (el.classList.contains('note-code-block')) {
      const codeText = (
        el.querySelector('pre code')?.textContent ||
        el.querySelector('pre')?.textContent ||
        ''
      ).replace(/\u00a0/g, ' ').trim();
      if (codeText) blocks.push({ type: 'code', text: codeText });
      return;
    }

    if (el.classList.contains('note-image-block')) {
      const img = el.querySelector('img');
      if (img?.src) blocks.push({ type: 'image', src: img.src });
      return;
    }

    if (tag === 'img') {
      const src = el.getAttribute('src');
      if (src) blocks.push({ type: 'image', src });
      return;
    }

    if (el.classList.contains('note-check-item')) {
      const checked = el.getAttribute('data-checked') === 'true';
      const textEl = el.querySelector('.note-check-text');
      const text = (textEl ? textEl.textContent : el.textContent || '').trim();
      if (text) blocks.push({ type: 'checklist', text, checked });
      return;
    }

    if (tag === 'hr') {
      blocks.push({ type: 'divider' });
      return;
    }

    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
      const text = (el.textContent || '').replace(/\u00a0/g, ' ').trim();
      if (text) blocks.push({ type: 'heading', text });
      return;
    }

    if (tag === 'ul') {
      Array.from(el.children).forEach((li) => {
        const text = (li.textContent || '').replace(/\u00a0/g, ' ').trim();
        if (text) blocks.push({ type: 'bullet', text });
      });
      return;
    }

    if (tag === 'ol') {
      let idx = 1;
      Array.from(el.children).forEach((li) => {
        const text = (li.textContent || '').replace(/\u00a0/g, ' ').trim();
        if (text) {
          blocks.push({ type: 'numbered', text, index: idx });
          idx += 1;
        }
      });
      return;
    }

    if (tag === 'blockquote') {
      const text = (el.textContent || '').replace(/\u00a0/g, ' ').trim();
      if (text) blocks.push({ type: 'quote', text });
      return;
    }

    if (tag === 'table') {
      const tableRows: { cells: string[]; isHeader: boolean }[] = [];
      Array.from(el.querySelectorAll('tr')).forEach((tr, rowIdx) => {
        const cellEls = Array.from(tr.querySelectorAll('th, td'));
        const cells = cellEls.map((c) => (c.textContent || '').replace(/\u00a0/g, ' ').trim());
        if (cells.length > 0) {
          const hasTh = cellEls.some((c) => c.tagName.toLowerCase() === 'th');
          tableRows.push({ cells, isHeader: hasTh || rowIdx === 0 });
        }
      });
      if (tableRows.length > 0) {
        blocks.push({ type: 'table', rows: tableRows });
      }
      return;
    }

    if (tag === 'p' || tag === 'div' || tag === 'li') {
      const hasNestedBlock = Array.from(el.children).some((child) =>
        [
          'p',
          'div',
          'ul',
          'ol',
          'blockquote',
          'table',
          'hr',
          'h1',
          'h2',
          'h3',
          'h4',
          'img',
        ].includes(child.tagName.toLowerCase()) ||
        child.classList.contains('note-check-item') ||
        child.classList.contains('note-image-block')
      );
      if (hasNestedBlock) {
        Array.from(el.childNodes).forEach(walk);
      } else {
        const text = (el.textContent || '').replace(/\u00a0/g, ' ').trim();
        if (text) blocks.push({ type: 'paragraph', text });
      }
      return;
    }

    Array.from(el.childNodes).forEach(walk);
  };

  Array.from(container.childNodes).forEach(walk);

  const inlineSet = new Set(
    blocks.filter((b) => b.type === 'image' && b.src).map((b) => b.src as string)
  );
  const extraImages = extractNoteImages('', note.images);
  extraImages.forEach((src) => {
    if (!inlineSet.has(src)) blocks.push({ type: 'image', src });
  });

  return blocks;
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  const paragraphs = text.split(/\r?\n/);

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        if (current) {
          lines.push(current);
          current = '';
        }
        if (ctx.measureText(word).width <= maxWidth) {
          current = word;
        } else {
          // Break oversized token cleanly by graphemes so Bengali/long URLs wrap safely
          const segmenter =
            typeof Intl !== 'undefined' && 'Segmenter' in Intl
              ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
              : null;
          const units = segmenter
            ? Array.from(segmenter.segment(word), (s) => s.segment)
            : Array.from(word);
          let chunk = '';
          for (const unit of units) {
            if (ctx.measureText(chunk + unit).width > maxWidth && chunk) {
              lines.push(chunk);
              chunk = unit;
            } else {
              chunk += unit;
            }
          }
          current = chunk;
        }
      }
    }
    if (current) lines.push(current);
  }

  return lines.length > 0 ? lines : [''];
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function renderNoteToPdfBytes(note: Note, folderName: string): Promise<Uint8Array> {
  const pageWidthPx = 1240;
  const pageHeightPx = 1754;
  const marginX = 96;
  const marginTop = 96;
  const marginBottom = 104;
  const contentWidth = pageWidthPx - marginX * 2;
  const fontFamily = '"Noto Sans Bengali", "Hind Siliguri", system-ui, -apple-system, sans-serif';

  const pageCanvases: HTMLCanvasElement[] = [];

  const createPage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = pageWidthPx;
    canvas.height = pageHeightPx;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, pageWidthPx, pageHeightPx);
    pageCanvases.push(canvas);
    return { canvas, ctx, y: marginTop };
  };

  let page = createPage();

  const ensureSpace = (neededHeight: number) => {
    if (page.y + neededHeight > pageHeightPx - marginBottom) {
      page = createPage();
    }
  };

  // Title
  const titleText = note.title.trim() || 'Untitled Note';
  page.ctx.fillStyle = '#171717';
  page.ctx.font = `700 44px ${fontFamily}`;
  const titleLines = wrapCanvasText(page.ctx, titleText, contentWidth);
  for (const line of titleLines) {
    ensureSpace(58);
    page.ctx.fillStyle = '#171717';
    page.ctx.font = `700 44px ${fontFamily}`;
    page.ctx.fillText(line, marginX, page.y + 42);
    page.y += 58;
  }

  // Metadata
  page.y += 8;
  const metaText = `${folderName} · ${formatFullDate(note.updatedAt)}`;
  page.ctx.fillStyle = '#6B7280';
  page.ctx.font = `500 22px ${fontFamily}`;
  page.ctx.fillText(metaText, marginX, page.y + 22);
  page.y += 42;

  // Divider
  page.ctx.strokeStyle = '#E5E7EB';
  page.ctx.lineWidth = 2;
  page.ctx.beginPath();
  page.ctx.moveTo(marginX, page.y);
  page.ctx.lineTo(pageWidthPx - marginX, page.y);
  page.ctx.stroke();
  page.y += 38;

  const blocks = parseHtmlToPdfBlocks(note);
  if (blocks.length === 0) {
    page.ctx.fillStyle = '#9CA3AF';
    page.ctx.font = `400 26px ${fontFamily}`;
    page.ctx.fillText('(Empty note)', marginX, page.y + 26);
  }

  for (const block of blocks) {
    if (block.type === 'divider') {
      ensureSpace(32);
      page.y += 10;
      page.ctx.strokeStyle = '#E5E7EB';
      page.ctx.lineWidth = 2;
      page.ctx.beginPath();
      page.ctx.moveTo(marginX, page.y);
      page.ctx.lineTo(pageWidthPx - marginX, page.y);
      page.ctx.stroke();
      page.y += 22;
      continue;
    }

    if (block.type === 'image' && block.src) {
      const img = await loadImageElement(block.src);
      if (!img || !img.naturalWidth || !img.naturalHeight) continue;

      const maxImgW = contentWidth;
      const maxImgH = 560;
      const scale = Math.min(maxImgW / img.naturalWidth, maxImgH / img.naturalHeight, 1);
      const drawW = Math.round(img.naturalWidth * scale);
      const drawH = Math.round(img.naturalHeight * scale);

      ensureSpace(drawH + 24);
      try {
        page.ctx.drawImage(img, marginX, page.y, drawW, drawH);
        page.y += drawH + 24;
      } catch {
        // Ignore tainted cross-origin images
      }
      continue;
    }

    if (block.type === 'table' && block.rows && block.rows.length > 0) {
      const colCount = Math.max(...block.rows.map((r) => r.cells.length), 1);
      const colWidth = contentWidth / colCount;
      const cellPadX = 14;
      const cellPadY = 12;
      const rowLineH = 34;

      for (const row of block.rows) {
        const rowFont = `${row.isHeader ? '700' : '400'} 23px ${fontFamily}`;
        page.ctx.font = rowFont;
        const wrappedCells = Array.from({ length: colCount }, (_, colIdx) => {
          const val = row.cells[colIdx] || '';
          return val ? wrapCanvasText(page.ctx, val, Math.max(40, colWidth - cellPadX * 2)) : [''];
        });
        const maxLines = Math.max(...wrappedCells.map((lines) => lines.length), 1);
        const rowHeight = maxLines * rowLineH + cellPadY * 2;

        ensureSpace(rowHeight + 6);

        if (row.isHeader) {
          page.ctx.fillStyle = '#F3F4F6';
          page.ctx.fillRect(marginX, page.y, contentWidth, rowHeight);
        }

        page.ctx.strokeStyle = '#D1D5DB';
        page.ctx.lineWidth = 1.5;
        page.ctx.strokeRect(marginX, page.y, contentWidth, rowHeight);

        for (let colIdx = 0; colIdx < colCount; colIdx += 1) {
          const cellX = marginX + colIdx * colWidth;
          if (colIdx > 0) {
            page.ctx.beginPath();
            page.ctx.moveTo(cellX, page.y);
            page.ctx.lineTo(cellX, page.y + rowHeight);
            page.ctx.stroke();
          }

          page.ctx.font = rowFont;
          page.ctx.fillStyle = row.isHeader ? '#111827' : '#1F2937';
          const lines = wrappedCells[colIdx];
          lines.forEach((line, lineIdx) => {
            if (line) {
              page.ctx.fillText(
                line,
                cellX + cellPadX,
                page.y + cellPadY + 23 + lineIdx * rowLineH
              );
            }
          });
        }

        page.y += rowHeight;
      }
      page.y += 20;
      continue;
    }

    const rawText = block.text || '';
    if (!rawText) continue;

    if (block.type === 'heading') {
      page.y += 8;
      page.ctx.font = `700 32px ${fontFamily}`;
      const lines = wrapCanvasText(page.ctx, rawText, contentWidth);
      for (const line of lines) {
        ensureSpace(44);
        page.ctx.fillStyle = '#111827';
        page.ctx.font = `700 32px ${fontFamily}`;
        page.ctx.fillText(line, marginX, page.y + 30);
        page.y += 44;
      }
      page.y += 8;
      continue;
    }

    if (block.type === 'quote') {
      page.ctx.font = `italic 26px ${fontFamily}`;
      const lines = wrapCanvasText(page.ctx, rawText, contentWidth - 36);
      const blockHeight = lines.length * 38 + 12;
      ensureSpace(blockHeight);
      page.ctx.fillStyle = '#D97706';
      page.ctx.fillRect(marginX, page.y + 4, 6, blockHeight - 14);
      page.ctx.fillStyle = '#4B5563';
      for (const line of lines) {
        page.ctx.fillText(line, marginX + 24, page.y + 26);
        page.y += 38;
      }
      page.y += 14;
      continue;
    }

    if (block.type === 'code') {
      const monoFont = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      page.ctx.font = `400 22px ${monoFont}`;
      const lines = wrapCanvasText(page.ctx, rawText, contentWidth - 40);
      const lineH = 32;
      const padY = 18;
      const boxHeight = lines.length * lineH + padY * 2;
      ensureSpace(Math.min(boxHeight + 14, pageHeightPx - marginTop - marginBottom));
      page.ctx.fillStyle = '#F3F4F6';
      page.ctx.fillRect(marginX, page.y, contentWidth, boxHeight);
      page.ctx.strokeStyle = '#E5E7EB';
      page.ctx.lineWidth = 1.5;
      page.ctx.strokeRect(marginX, page.y, contentWidth, boxHeight);
      page.ctx.fillStyle = '#111827';
      page.ctx.font = `400 22px ${monoFont}`;
      lines.forEach((line, idx) => {
        page.ctx.fillText(line, marginX + 20, page.y + padY + 20 + idx * lineH);
      });
      page.y += boxHeight + 16;
      continue;
    }

    const prefix =
      block.type === 'bullet'
        ? '•  '
        : block.type === 'numbered'
        ? `${block.index ?? 1}.  `
        : block.type === 'checklist'
        ? block.checked
          ? '☑  '
          : '☐  '
        : '';

    const indent = prefix ? 34 : 0;
    page.ctx.font = `400 26px ${fontFamily}`;
    const lines = wrapCanvasText(page.ctx, rawText, contentWidth - indent);

    lines.forEach((line, idx) => {
      ensureSpace(40);
      page.ctx.font = `400 26px ${fontFamily}`;
      page.ctx.fillStyle = block.type === 'checklist' && block.checked ? '#6B7280' : '#1F2937';
      if (idx === 0 && prefix) {
        page.ctx.fillText(prefix, marginX, page.y + 26);
      }
      page.ctx.fillText(line, marginX + indent, page.y + 26);
      page.y += 40;
    });
    page.y += 12;
  }

  // Page numbers
  const totalPages = pageCanvases.length;
  pageCanvases.forEach((canvas, idx) => {
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#9CA3AF';
    ctx.font = `500 20px ${fontFamily}`;
    const footer = `${idx + 1} / ${totalPages}`;
    const w = ctx.measureText(footer).width;
    ctx.fillText(footer, pageWidthPx - marginX - w, pageHeightPx - 48);
  });

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  });

  pageCanvases.forEach((canvas, idx) => {
    if (idx > 0) pdf.addPage();
    const imgData = canvas.toDataURL('image/jpeg', 0.9);
    pdf.addImage(imgData, 'JPEG', 0, 0, 595.28, 841.89);
  });

  const buffer = pdf.output('arraybuffer');
  return new Uint8Array(buffer);
}

async function saveAndShareZip(
  zip: JSZip,
  fileName: string,
  options?: { preferSilentDocuments?: boolean }
): Promise<'shared' | 'saved' | 'downloaded'> {
  if (Capacitor.isNativePlatform()) {
    const base64Data = await zip.generateAsync({
      type: 'base64',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    let savedToDocuments = false;
    try {
      await Filesystem.writeFile({
        path: `Notes/${fileName}`,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      });
      savedToDocuments = true;
    } catch {
      // Cache + Share works across all Android versions without storage permissions
    }

    if (options?.preferSilentDocuments && savedToDocuments) {
      return 'saved';
    }

    const cached = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true,
    });

    await Share.share({
      title: fileName,
      files: [cached.uri],
      dialogTitle: `Save or share ${fileName}`,
    });
    return 'shared';
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return 'downloaded';
}

export async function exportNotesAsTextZip(
  notes: Note[],
  folders: Folder[]
): Promise<{ count: number; mode: 'shared' | 'saved' | 'downloaded' }> {
  const exportable = notes.filter((n) => !n.isDeleted);
  if (exportable.length === 0) {
    throw new Error('No notes available to export.');
  }

  const folderMap = new Map(folders.map((f) => [f.id, f.name]));
  const zip = new JSZip();
  const usedNames = new Set<string>();

  exportable.forEach((note, index) => {
    const baseName = sanitizeFileName(note.title, `Note ${index + 1}`);
    const fileName = createUniqueFileName(baseName, 'txt', usedNames);
    const folderName = folderMap.get(note.folderId) || 'Notes';
    const body = htmlToStructuredText(note.content);

    const content = [
      note.title.trim() || 'Untitled Note',
      `Folder: ${folderName}`,
      `Updated: ${formatFullDate(note.updatedAt)}`,
      '----------------------------------------',
      '',
      body || '(Empty note)',
      '',
    ].join('\n');

    zip.file(fileName, `\uFEFF${content}`);
  });

  const dateTag = new Date().toISOString().slice(0, 10);
  const mode = await saveAndShareZip(zip, `notes-text-${dateTag}.zip`);
  return { count: exportable.length, mode };
}

export async function exportNotesAsPdfZip(
  notes: Note[],
  folders: Folder[],
  options?: { preferSilentDocuments?: boolean }
): Promise<{ count: number; mode: 'shared' | 'saved' | 'downloaded' }> {
  const exportable = notes.filter((n) => !n.isDeleted);
  if (exportable.length === 0) {
    throw new Error('No notes available to export.');
  }

  const folderMap = new Map(folders.map((f) => [f.id, f.name]));
  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (let i = 0; i < exportable.length; i += 1) {
    const note = exportable[i];
    const baseName = sanitizeFileName(note.title, `Note ${i + 1}`);
    const fileName = createUniqueFileName(baseName, 'pdf', usedNames);
    const folderName = folderMap.get(note.folderId) || 'Notes';
    const pdfBytes = await renderNoteToPdfBytes(note, folderName);
    zip.file(fileName, pdfBytes);
  }

  const dateTag = new Date().toISOString().slice(0, 10);
  const mode = await saveAndShareZip(zip, `notes-pdf-${dateTag}.zip`, options);
  return { count: exportable.length, mode };
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export async function exportSingleNoteAsPdf(
  note: Note,
  folderName: string
): Promise<{ fileName: string; mode: 'shared' | 'downloaded'; savedToDocuments: boolean }> {
  const baseName = sanitizeFileName(note.title, 'Untitled Note');
  const fileName = `${baseName}.pdf`;
  const pdfBytes = await renderNoteToPdfBytes(note, folderName || 'Notes');

  if (Capacitor.isNativePlatform()) {
    const base64Data = uint8ArrayToBase64(pdfBytes);

    let savedToDocuments = false;
    try {
      await Filesystem.writeFile({
        path: `Notes/${fileName}`,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      });
      savedToDocuments = true;
    } catch {
      // Cache + Share works across all Android versions without extra storage permissions
    }

    const cached = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true,
    });

    await Share.share({
      title: note.title.trim() || 'Untitled Note',
      files: [cached.uri],
      dialogTitle: `Save or share ${fileName}`,
    });

    return { fileName, mode: 'shared', savedToDocuments };
  }

  const copy = new Uint8Array(pdfBytes.byteLength);
  copy.set(pdfBytes);
  const blob = new Blob([copy.buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return { fileName, mode: 'downloaded', savedToDocuments: false };
}
