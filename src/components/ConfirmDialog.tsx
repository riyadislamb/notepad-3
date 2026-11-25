import React, { useEffect, useState } from 'react';
import { Check, Folder as FolderIcon, Trash2, X } from 'lucide-react';
import { useBackHandler } from '../context/NotesContext';
import { CV_GENERATION_FOLDER_ID } from '../data/initialData';
import { Folder } from '../types/notes';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  useBackHandler(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-[var(--bg-card)] border border-[var(--divider)] p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {danger && (
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#E45B5B]/12 text-[#E45B5B]">
            <Trash2 className="h-5 w-5" strokeWidth={1.75} />
          </div>
        )}
        <h2
          id="confirm-dialog-title"
          className="text-lg font-semibold text-[var(--text-primary)]"
        >
          {title}
        </h2>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)] leading-relaxed">
          {description}
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`min-h-[44px] w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity active:opacity-85 cursor-pointer ${
              danger
                ? 'bg-[#E45B5B] text-white'
                : 'bg-[var(--text-primary)] text-[var(--bg-card)] dark:bg-[var(--accent-primary)] dark:text-[#171717]'
            }`}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] w-full rounded-xl bg-[var(--bg-canvas)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface FolderNameDialogProps {
  open: boolean;
  title: string;
  initialValue?: string;
  confirmLabel?: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

export function FolderNameDialog({
  open,
  title,
  initialValue = '',
  confirmLabel = 'Save',
  onSubmit,
  onClose,
}: FolderNameDialogProps) {
  const [name, setName] = useState(initialValue);

  useEffect(() => {
    if (open) setName(initialValue);
  }, [open, initialValue]);

  useBackHandler(open, onClose);
  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-[var(--bg-card)] border border-[var(--divider)] p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Folder name"
          aria-label="Folder name"
          autoFocus
          maxLength={40}
          className="w-full min-h-[46px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
        />

        <div className="mt-5 flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-xl bg-[var(--bg-canvas)] px-4 text-sm font-medium text-[var(--text-primary)] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="flex-1 min-h-[44px] rounded-xl bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] disabled:opacity-40 cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

interface FolderPickerDialogProps {
  open: boolean;
  title?: string;
  folders: Folder[];
  selectedFolderId: string;
  onSelect: (folderId: string) => void;
  onClose: () => void;
}

export function FolderPickerDialog({
  open,
  title = 'Move to Folder',
  folders,
  selectedFolderId,
  onSelect,
  onClose,
}: FolderPickerDialogProps) {
  useBackHandler(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl bg-[var(--bg-card)] border border-[var(--divider)] p-6"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--divider)] sm:hidden" />
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="divide-y divide-[var(--divider)] max-h-72 overflow-y-auto">
          {folders.filter((f) => !f.isSystem && f.id !== CV_GENERATION_FOLDER_ID).length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-secondary)]">
              No folders yet. Create one in Folders first.
            </p>
          ) : (
            folders
              .filter((f) => !f.isSystem && f.id !== CV_GENERATION_FOLDER_ID)
              .map((folder) => {
              const active = folder.id === selectedFolderId;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => {
                    onSelect(folder.id);
                    onClose();
                  }}
                  className="flex w-full min-h-[48px] items-center justify-between py-2.5 px-1 text-left transition-colors hover:bg-[var(--bg-subtle)] rounded-lg cursor-pointer"
                >
                  <span className="flex items-center gap-3 text-sm font-medium text-[var(--text-primary)]">
                    <FolderIcon
                      className={`h-4 w-4 ${
                        active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'
                      }`}
                      strokeWidth={1.75}
                    />
                    {folder.name}
                  </span>
                  {active && (
                    <Check className="h-4 w-4 text-[var(--accent-primary)]" strokeWidth={2.25} />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

interface InfoSheetDialogProps {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

export function InfoSheetDialog({ open, title, children, onClose }: InfoSheetDialogProps) {
  useBackHandler(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[var(--bg-card)] border border-[var(--divider)] p-6 max-h-[85vh] flex flex-col"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--divider)] sm:hidden" />
        <div className="flex items-center justify-between pb-3 border-b border-[var(--divider)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 overflow-y-auto text-sm text-[var(--text-primary)] leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}
