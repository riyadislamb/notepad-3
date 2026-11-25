import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, CheckSquare, FolderInput, RotateCcw, Trash2, X } from 'lucide-react';
import { useBackHandler, useNotes } from '../context/NotesContext';
import { FolderPickerDialog } from './ConfirmDialog';

export function useBulkSelection(visibleIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [forceMode, setForceMode] = useState(false);

  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.length === 0) return prev;
      const visibleSet = new Set(visibleIds);
      const next = prev.filter((id) => visibleSet.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [visibleIds]);

  const selectionMode = forceMode || selectedIds.length > 0;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));

  const enterSelectionMode = useCallback(() => {
    setForceMode(true);
  }, []);

  const startSelection = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const prevSet = new Set(prev);
      const currentlyAll = visibleIds.length > 0 && visibleIds.every((id) => prevSet.has(id));
      return currentlyAll ? [] : [...visibleIds];
    });
  }, [visibleIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setForceMode(false);
  }, []);

  useBackHandler(selectionMode, clearSelection);

  const isSelected = useCallback((id: string) => selectedSet.has(id), [selectedSet]);

  return {
    selectionMode,
    selectedIds,
    selectedCount: selectedIds.length,
    allSelected,
    isSelected,
    enterSelectionMode,
    startSelection,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
  };
}

interface BulkActionBarProps {
  selectionMode?: boolean;
  selectedIds: string[];
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onClear: () => void;
  mode?: 'active' | 'archive';
}

export function BulkActionBar({
  selectionMode,
  selectedIds,
  allSelected,
  onToggleSelectAll,
  onClear,
  mode = 'active',
}: BulkActionBarProps) {
  const {
    folders,
    bulkMoveNotes,
    bulkArchiveNotes,
    bulkRestoreArchivedNotes,
    bulkDeleteNotes,
  } = useNotes();
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);

  const isVisible = selectionMode ?? selectedIds.length > 0;
  if (!isVisible) return null;

  const hasSelection = selectedIds.length > 0;

  return (
    <>
      <div
        role="region"
        aria-label="Bulk selection actions"
        className="fixed bottom-0 left-0 right-0 lg:left-64 z-40 border-t border-[var(--divider)] bg-[var(--bg-card)]/95 backdrop-blur-md px-4 sm:px-8 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto max-w-4xl flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClear}
              aria-label="Exit selection"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-primary)] hover:opacity-85 cursor-pointer"
            >
              <X className="h-4 w-4" strokeWidth={2.2} />
            </button>
            <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
              {selectedIds.length} selected
            </span>
            <button
              type="button"
              onClick={onToggleSelectAll}
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-[var(--bg-subtle)] px-3 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--accent-soft)] cursor-pointer"
            >
              <CheckSquare className="h-3.5 w-3.5 text-[var(--accent-primary)]" strokeWidth={2} />
              <span>{allSelected ? 'Clear All' : 'Select All'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!hasSelection}
              onClick={() => setFolderPickerOpen(true)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)]/70 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <FolderInput className="h-3.5 w-3.5" strokeWidth={1.9} />
              <span>Move</span>
            </button>

            {mode === 'archive' ? (
              <button
                type="button"
                disabled={!hasSelection}
                onClick={() => {
                  bulkRestoreArchivedNotes(selectedIds);
                  onClear();
                }}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)]/70 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.9} />
                <span>Restore</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!hasSelection}
                onClick={() => {
                  bulkArchiveNotes(selectedIds);
                  onClear();
                }}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)]/70 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Archive className="h-3.5 w-3.5" strokeWidth={1.9} />
                <span>Archive</span>
              </button>
            )}

            <button
              type="button"
              disabled={!hasSelection}
              onClick={() => {
                bulkDeleteNotes(selectedIds);
                onClear();
              }}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#E45B5B]/12 px-3 text-xs font-semibold text-[#E45B5B] hover:bg-[#E45B5B]/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>

      <FolderPickerDialog
        open={folderPickerOpen}
        title={`Move ${selectedIds.length} ${selectedIds.length === 1 ? 'Note' : 'Notes'} to Folder`}
        folders={folders}
        selectedFolderId=""
        onSelect={(folderId) => {
          bulkMoveNotes(selectedIds, folderId);
          onClear();
        }}
        onClose={() => setFolderPickerOpen(false)}
      />
    </>
  );
}
