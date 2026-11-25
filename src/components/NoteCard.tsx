import React, { useEffect, useRef, useState } from 'react';
import { Archive, Check, Image as ImageIcon, Lock, Pin, RotateCcw, Star, Trash2 } from 'lucide-react';
import { useNotes } from '../context/NotesContext';
import { Folder, Note } from '../types/notes';
import { extractNoteImages, formatNoteDate, getNotePreview } from '../utils/noteHelpers';

interface NoteCardProps {
  note: Note;
  folder?: Folder;
  onClick: () => void;
  showFolderName?: boolean;
  onRestore?: () => void;
  onPermanentDelete?: () => void;
  swipeable?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onLongPress?: () => void;
  footerBadge?: string;
  previewLines?: 1 | 2;
  highlightedBorder?: boolean;
}

export function NoteCard({
  note,
  folder,
  onClick,
  showFolderName = true,
  onRestore,
  onPermanentDelete,
  swipeable,
  selectionMode = false,
  selected = false,
  onLongPress,
  footerBadge,
  previewLines = 2,
  highlightedBorder = false,
}: NoteCardProps) {
  const { archiveNote, deleteNote, noteLockMethod, biometryLabel } = useNotes();
  const [imgError, setImgError] = useState(false);

  const canSwipe = !selectionMode && (swipeable ?? (!onRestore && !onPermanentDelete));

  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const axisRef = useRef<'x' | 'y' | null>(null);
  const pointerActiveRef = useRef(false);
  const draggedRef = useRef(false);
  const offsetXRef = useRef(0);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const onLongPressRef = useRef(onLongPress);
  onLongPressRef.current = onLongPress;

  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dismissDirection, setDismissDirection] = useState<'left' | 'right' | null>(null);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => {
    setOffsetX(0);
    setDismissDirection(null);
    setIsDragging(false);
  }, [note.id]);

  useEffect(() => {
    if (selectionMode) {
      clearLongPressTimer();
      pointerActiveRef.current = false;
      axisRef.current = null;
      offsetXRef.current = 0;
      setOffsetX(0);
      setIsDragging(false);
    }
  }, [selectionMode]);

  useEffect(() => {
    return () => clearLongPressTimer();
  }, []);

  const getThreshold = () => {
    const width = containerRef.current?.offsetWidth || 320;
    return Math.min(115, Math.max(82, width * 0.32));
  };

  useEffect(() => {
    const handleWindowMove = (e: PointerEvent) => {
      const dx = e.clientX - startXRef.current;
      const dy = e.clientY - startYRef.current;

      if (longPressTimerRef.current !== null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        clearLongPressTimer();
      }

      if (!canSwipe || !pointerActiveRef.current) return;

      if (!axisRef.current) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        clearLongPressTimer();
        if (Math.abs(dx) > Math.abs(dy) * 1.15) {
          axisRef.current = 'x';
          draggedRef.current = true;
          setIsDragging(true);
        } else {
          axisRef.current = 'y';
          pointerActiveRef.current = false;
          return;
        }
      }

      if (axisRef.current === 'x') {
        offsetXRef.current = dx;
        setOffsetX(dx);
      }
    };

    const handleWindowUp = () => {
      clearLongPressTimer();
      if (!canSwipe || !pointerActiveRef.current) return;
      pointerActiveRef.current = false;
      const currentX = offsetXRef.current;
      const wasHorizontal = axisRef.current === 'x';
      axisRef.current = null;
      setIsDragging(false);

      if (!wasHorizontal) return;

      const threshold = getThreshold();
      if (currentX >= threshold) {
        setDismissDirection('right');
        setOffsetX((containerRef.current?.offsetWidth || 360) + 24);
        window.setTimeout(() => {
          deleteNote(note.id);
        }, 180);
      } else if (currentX <= -threshold) {
        setDismissDirection('left');
        setOffsetX(-((containerRef.current?.offsetWidth || 360) + 24));
        window.setTimeout(() => {
          archiveNote(note.id);
        }, 180);
      } else {
        offsetXRef.current = 0;
        setOffsetX(0);
      }
    };

    window.addEventListener('pointermove', handleWindowMove);
    window.addEventListener('pointerup', handleWindowUp);
    window.addEventListener('pointercancel', handleWindowUp);
    return () => {
      window.removeEventListener('pointermove', handleWindowMove);
      window.removeEventListener('pointerup', handleWindowUp);
      window.removeEventListener('pointercancel', handleWindowUp);
    };
  }, [archiveNote, canSwipe, deleteNote, note.id]);

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (dismissDirection) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    offsetXRef.current = 0;
    longPressTriggeredRef.current = false;

    if (canSwipe) {
      pointerActiveRef.current = true;
      draggedRef.current = false;
      axisRef.current = null;
    }

    if (onLongPressRef.current && !selectionMode) {
      clearLongPressTimer();
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null;
        longPressTriggeredRef.current = true;
        pointerActiveRef.current = false;
        axisRef.current = null;
        offsetXRef.current = 0;
        setOffsetX(0);
        setIsDragging(false);
        try {
          navigator.vibrate?.(15);
        } catch {
          // Ignore vibrate errors
        }
        onLongPressRef.current?.();
      }, 450);
    }
  };

  const handleCardClick = () => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    onClick();
  };

  const titleText = note.title.trim() || 'Untitled Note';
  const isLocked = Boolean(note.isLocked);
  const preview = isLocked
    ? noteLockMethod === 'fingerprint'
      ? `Locked note · Use ${biometryLabel.toLowerCase()} to view`
      : 'Locked note · Enter PIN to view'
    : getNotePreview(note.content, 125);
  const dateText = formatNoteDate(note.updatedAt);
  const allImages = !isLocked ? extractNoteImages(note.content, note.images) : [];
  const firstImage = allImages[0] || null;

  const threshold = getThreshold();
  const isSwipingRight = offsetX > 6;
  const isSwipingLeft = offsetX < -6;
  const pastThreshold = Math.abs(offsetX) >= threshold;
  const isUrgentBadge = footerBadge === 'Expires today' || footerBadge === 'Expiring soon';

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-2xl touch-pan-y select-none"
    >
      {/* Revealed Swipe Action Backdrop */}
      {canSwipe && (isSwipingRight || isSwipingLeft || dismissDirection) && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 flex items-center rounded-2xl px-6 transition-colors ${
            isSwipingRight || dismissDirection === 'right'
              ? 'justify-start bg-[#E45B5B] text-white'
              : 'justify-end bg-[#D9A928] text-[#171717]'
          }`}
        >
          {isSwipingRight || dismissDirection === 'right' ? (
            <div
              className={`flex items-center gap-2 transition-transform duration-150 ${
                pastThreshold ? 'scale-105' : 'scale-95 opacity-85'
              }`}
            >
              <Trash2 className="h-5 w-5" strokeWidth={2} />
              <span className="text-sm font-semibold">Delete</span>
            </div>
          ) : (
            <div
              className={`flex items-center gap-2 transition-transform duration-150 ${
                pastThreshold ? 'scale-105' : 'scale-95 opacity-85'
              }`}
            >
              <span className="text-sm font-semibold">Archive</span>
              <Archive className="h-5 w-5" strokeWidth={2} />
            </div>
          )}
        </div>
      )}

      {/* Foreground Note Card */}
      <article
        onPointerDown={handlePointerDown}
        onContextMenu={(e) => {
          if (onLongPress || selectionMode) {
            e.preventDefault();
          }
        }}
        style={{
          transform: `translate3d(${offsetX}px, 0, 0)`,
          opacity: dismissDirection ? 0 : 1,
          transition: isDragging
            ? 'none'
            : 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease',
        }}
        className={`relative z-10 rounded-2xl transition-colors ${
          highlightedBorder ? 'border-2' : 'border'
        } ${
          selectionMode && selected
            ? 'bg-[var(--accent-soft)]/45 border-[var(--accent-primary)]'
            : highlightedBorder
              ? 'bg-[var(--bg-card)] border-[var(--accent-primary)]/45 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none hover:border-[var(--accent-primary)]'
              : 'bg-[var(--bg-card)] border-[var(--card-border)] shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none hover:border-[var(--accent-primary)]/70'
        }`}
      >
        <button
          type="button"
          onClick={handleCardClick}
          className="w-full text-left p-3 sm:p-3.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] rounded-2xl flex items-start justify-between gap-3"
        >
          {selectionMode && (
            <span
              aria-hidden="true"
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                selected
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white dark:text-[#171717]'
                  : 'border-[var(--text-secondary)]/50 bg-[var(--bg-canvas)]'
              }`}
            >
              {selected && <Check className="h-3 w-3" strokeWidth={2.75} />}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[15px] sm:text-base font-semibold text-[var(--text-primary)] leading-snug line-clamp-1">
                {titleText}
              </h3>
              {(isLocked || note.isPinned || note.isFavorite) && (
                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                  {isLocked && (
                    <Lock
                      className="h-3.5 w-3.5 text-[var(--text-secondary)]"
                      strokeWidth={2}
                      aria-label="Locked"
                    />
                  )}
                  {note.isPinned && (
                    <Pin
                      className="h-3.5 w-3.5 text-[var(--accent-primary)] fill-[var(--accent-primary)]"
                      strokeWidth={2}
                      aria-label="Pinned"
                    />
                  )}
                  {note.isFavorite && (
                    <Star
                      className="h-3.5 w-3.5 text-[var(--accent-primary)] fill-[var(--accent-primary)]"
                      strokeWidth={2}
                      aria-label="Favorite"
                    />
                  )}
                </div>
              )}
            </div>

            <p
              className={`mt-1 text-[13.5px] sm:text-sm text-[var(--text-secondary)] leading-snug ${
                previewLines === 1 ? 'line-clamp-1' : 'line-clamp-2'
              }`}
            >
              {preview}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-secondary)] tabular-nums">
              <span>{dateText}</span>
              {showFolderName && folder && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate max-w-[140px]">{folder.name}</span>
                </>
              )}
              {!isLocked && allImages.length > 1 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{allImages.length} photos</span>
                </>
              )}
              {footerBadge && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className={isUrgentBadge ? 'font-medium text-[#E45B5B]' : ''}>
                    {footerBadge}
                  </span>
                </>
              )}
            </div>
          </div>

          {firstImage && (
            <div className="h-14 w-14 shrink-0 rounded-xl overflow-hidden bg-[var(--bg-canvas)] border border-[var(--card-border)] flex items-center justify-center">
              {!imgError ? (
                <img
                  src={firstImage}
                  alt={titleText}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon className="h-5 w-5 text-[var(--text-secondary)]" strokeWidth={1.6} />
              )}
            </div>
          )}
        </button>

        {!selectionMode && (onRestore || onPermanentDelete) && (
          <div className="flex items-center justify-end gap-2 px-4 pb-3 pt-2 border-t border-[var(--divider)]">
            {onRestore && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore();
                }}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-canvas)] hover:bg-[var(--accent-soft)] transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
                Restore
              </button>
            )}
            {onPermanentDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPermanentDelete();
                }}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-[#E45B5B] bg-[#E45B5B]/10 hover:bg-[#E45B5B]/15 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                Delete Forever
              </button>
            )}
          </div>
        )}
      </article>
    </div>
  );
}
