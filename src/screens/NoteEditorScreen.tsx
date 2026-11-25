import React, { useEffect, useRef, useState } from 'react';
import {
  Archive,
  Check,
  ChevronLeft,
  Fingerprint,
  FolderInput,
  Lock,
  MoreHorizontal,
  Pin,
  Star,
  Trash2,
  Unlock,
} from 'lucide-react';
import { ConfirmDialog, FolderPickerDialog } from '../components/ConfirmDialog';
import { LockMethodDialog } from '../components/LockMethodDialog';
import { NavigationShell } from '../components/NavigationShell';
import { PinDialog } from '../components/PinDialog';
import { RichTextEditor } from '../components/RichTextEditor';
import { useNotes } from '../context/NotesContext';
import { verifyBiometricIdentity } from '../utils/biometricHelper';
import { extractNoteImages } from '../utils/noteHelpers';

interface NoteEditorScreenProps {
  mode: 'create' | 'edit';
}

export function NoteEditorScreen({ mode }: NoteEditorScreenProps) {
  const {
    activeNoteId,
    activeCursorTarget,
    getNoteById,
    getFolderById,
    folders,
    updateNote,
    togglePinNote,
    toggleFavoriteNote,
    toggleLockNote,
    notePin,
    setNotePin,
    noteLockMethod,
    enableFingerprintLock,
    unlockedNoteIds,
    unlockNoteSession,
    biometricSupported,
    biometryLabel,
    canUseNoteLock,
    requestUpgrade,
    moveNoteToFolder,
    archiveNote,
    deleteNote,
    goBack,
    navigate,
    permanentlyDeleteNote,
    showToast,
  } = useNotes();

  const note = activeNoteId ? getNoteById(activeNoteId) : undefined;

  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [images, setImages] = useState<string[]>(note?.images ?? []);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [menuOpen, setMenuOpen] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pinCreateOpen, setPinCreateOpen] = useState(false);
  const [pinVerifyOpen, setPinVerifyOpen] = useState(false);
  const [lockMethodOpen, setLockMethodOpen] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const autoBiometricPromptedNoteRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const [viewportStyle, setViewportStyle] = useState<{ height?: string }>({});

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const syncViewport = () => {
      setViewportStyle({ height: `${Math.round(vv.height)}px` });
      if (vv.offsetTop > 0) {
        window.scrollTo(0, 0);
      }
    };
    syncViewport();
    vv.addEventListener('resize', syncViewport);
    vv.addEventListener('scroll', syncViewport);
    return () => {
      vv.removeEventListener('resize', syncViewport);
      vv.removeEventListener('scroll', syncViewport);
    };
  }, []);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setImages(note.images ?? []);
    }
  }, [note?.id]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [menuOpen]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const isLockConfiguredForAuto =
    noteLockMethod === 'fingerprint' || (noteLockMethod === 'pin' && Boolean(notePin));
  const requiresUnlockForAuto = Boolean(
    note?.isLocked && isLockConfiguredForAuto && !unlockedNoteIds.includes(note.id)
  );

  useEffect(() => {
    if (!note) return;
    if (!requiresUnlockForAuto) {
      autoBiometricPromptedNoteRef.current = note.id;
      return;
    }
    if (
      noteLockMethod === 'fingerprint' &&
      biometricSupported &&
      autoBiometricPromptedNoteRef.current !== note.id
    ) {
      autoBiometricPromptedNoteRef.current = note.id;
      void (async () => {
        if (!isMountedRef.current) return;
        setBiometricBusy(true);
        try {
          const res = await verifyBiometricIdentity({
            title: note.title.trim() || 'Locked Note',
            subtitle: `Unlock with ${biometryLabel}`,
          });
          if (!isMountedRef.current) return;
          if (res.verified) {
            unlockNoteSession(note.id);
          } else if (!res.cancelled && res.errorMessage) {
            showToast(res.errorMessage, 'danger');
          }
        } finally {
          if (isMountedRef.current) {
            setBiometricBusy(false);
          }
        }
      })();
    }
  }, [
    biometricSupported,
    biometryLabel,
    note,
    noteLockMethod,
    requiresUnlockForAuto,
    showToast,
    unlockNoteSession,
  ]);

  if (!note) {
    return (
      <NavigationShell showMobileTabs={false}>
        <div className="p-8 text-center">
          <p className="text-sm text-[var(--text-secondary)]">Note not found.</p>
          <button
            type="button"
            onClick={() => navigate('home')}
            className="mt-4 min-h-[44px] rounded-full bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] px-5 text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] cursor-pointer"
          >
            Back to Notes
          </button>
        </div>
      </NavigationShell>
    );
  }

  const isLockConfigured = isLockConfiguredForAuto;
  const requiresPinUnlock = requiresUnlockForAuto;

  const handleBiometricUnlock = async () => {
    if (biometricBusy) return;
    setBiometricBusy(true);
    try {
      const res = await verifyBiometricIdentity({
        title: note.title.trim() || 'Locked Note',
        subtitle: `Unlock with ${biometryLabel}`,
      });
      if (!isMountedRef.current) return;
      if (res.verified) {
        unlockNoteSession(note.id);
      } else if (!res.cancelled && res.errorMessage) {
        showToast(res.errorMessage, 'danger');
      }
    } finally {
      if (isMountedRef.current) {
        setBiometricBusy(false);
      }
    }
  };

  if (requiresPinUnlock) {
    const isFingerprintMode = noteLockMethod === 'fingerprint';

    return (
      <NavigationShell showMobileTabs={false}>
        <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)]">
          <header className="sticky top-0 z-30 flex h-[57px] items-center bg-[var(--bg-canvas)]/95 border-b border-[var(--divider)] px-3 sm:px-6">
            <button
              type="button"
              onClick={goBack}
              aria-label="Back"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2} />
            </button>
          </header>
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
              <Lock className="h-7 w-7" strokeWidth={1.85} />
            </div>
            <h1 className="mt-5 text-xl font-bold text-[var(--text-primary)]">
              {note.title.trim() || 'Locked Note'}
            </h1>
            <p className="mt-1.5 text-sm text-[var(--text-secondary)] max-w-xs">
              {isFingerprintMode
                ? biometricSupported
                  ? biometricBusy
                    ? `Touch the ${biometryLabel.toLowerCase()} sensor to unlock.`
                    : `Touch the ${biometryLabel.toLowerCase()} sensor or tap below to edit this protected note.`
                  : `${biometryLabel} is unavailable on this device. Switch to 4-Digit PIN in Settings.`
                : 'Enter your 4-digit PIN to edit this protected note.'}
            </p>
            {isFingerprintMode ? (
              <div className="mt-6 flex flex-col items-center gap-2.5">
                {biometricSupported ? (
                  <button
                    type="button"
                    disabled={biometricBusy}
                    onClick={() => {
                      void handleBiometricUnlock();
                    }}
                    className="inline-flex items-center justify-center gap-2 min-h-[46px] rounded-full bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] px-6 text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] disabled:opacity-60 cursor-pointer"
                  >
                    <Fingerprint className="h-4.5 w-4.5" strokeWidth={2} />
                    {biometricBusy ? `Waiting for ${biometryLabel}...` : `Unlock with ${biometryLabel}`}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate('settings')}
                    className="min-h-[46px] rounded-full bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] px-6 text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] cursor-pointer"
                  >
                    Open Settings
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPinVerifyOpen(true)}
                className="mt-6 min-h-[46px] rounded-full bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] px-6 text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] cursor-pointer"
              >
                Unlock Note
              </button>
            )}
          </div>
          <PinDialog
            open={pinVerifyOpen}
            mode="verify"
            expectedPin={notePin}
            onSuccess={() => unlockNoteSession(note.id)}
            onClose={() => setPinVerifyOpen(false)}
          />
        </div>
      </NavigationShell>
    );
  }

  const scheduleAutoSave = (nextTitle: string, nextContent: string, nextImages: string[]) => {
    setSaveState('saving');
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      updateNote(note.id, { title: nextTitle, content: nextContent, images: nextImages });
      setSaveState('saved');
    }, 280);
  };

  const handleTitleChange = (nextTitle: string) => {
    setTitle(nextTitle);
    scheduleAutoSave(nextTitle, content, images);
  };

  const handleContentChange = (nextContent: string) => {
    setContent(nextContent);
    scheduleAutoSave(title, nextContent, images);
  };

  const handleImagesChange = (nextImages: string[]) => {
    setImages(nextImages);
    scheduleAutoSave(title, content, nextImages);
  };

  const handleToggleLock = () => {
    setMenuOpen(false);
    if (!canUseNoteLock) {
      requestUpgrade('Secure Note Lock is a Notes Premium feature.');
      return;
    }
    if (note.isLocked) {
      toggleLockNote(note.id);
      return;
    }
    if (!isLockConfigured) {
      setLockMethodOpen(true);
      return;
    }
    toggleLockNote(note.id);
  };

  const handleSelectFingerprintSetup = async () => {
    if (biometricBusy) return;
    setBiometricBusy(true);
    try {
      const res = await verifyBiometricIdentity({
        title: `Enable ${biometryLabel} Lock`,
        subtitle: 'Confirm your identity',
        reason: `Verify ${biometryLabel.toLowerCase()} to lock notes on this device`,
      });
      if (res.verified) {
        enableFingerprintLock();
        toggleLockNote(note.id);
        setLockMethodOpen(false);
      } else if (!res.cancelled && res.errorMessage) {
        showToast(res.errorMessage, 'danger');
      }
    } finally {
      setBiometricBusy(false);
    }
  };

  const handleBackOrDone = () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    const emptyTitle = !title.trim();
    const emptyContent = !content.replace(/<[^>]*>/g, '').trim();
    const emptyImages = extractNoteImages(content, images).length === 0;

    if (mode === 'create' && emptyTitle && emptyContent && emptyImages) {
      permanentlyDeleteNote(note.id);
      goBack();
      return;
    }

    updateNote(note.id, { title, content, images });
    setSaveState('saved');
    goBack();
  };

  const folder = getFolderById(note.folderId);

  return (
    <NavigationShell showMobileTabs={false} noPaddingBottom>
      <div
        style={viewportStyle}
        className="h-[100dvh] flex flex-col overflow-hidden bg-[var(--bg-canvas)]"
      >
        {/* Top Editor Header */}
        <header className="shrink-0 z-30 select-none flex h-[57px] items-center justify-between bg-[var(--bg-canvas)]/95 backdrop-blur-md border-b border-[var(--divider)] px-3 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBackOrDone}
              aria-label="Back"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2} />
            </button>

            <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
              {saveState === 'saving' ? (
                <span>Saving…</span>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 text-[var(--accent-primary)]" strokeWidth={2.2} />
                  <span>Saved</span>
                </>
              )}
              {folder && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="hidden sm:inline">{folder.name}</span>
                </>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => togglePinNote(note.id)}
              aria-label={note.isPinned ? 'Unpin note' : 'Pin note'}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-colors cursor-pointer ${
                note.isPinned
                  ? 'text-[var(--accent-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Pin
                className={`h-[18px] w-[18px] ${
                  note.isPinned ? 'fill-[var(--accent-primary)]' : ''
                }`}
                strokeWidth={1.9}
              />
            </button>

            <button
              type="button"
              onClick={() => toggleFavoriteNote(note.id)}
              aria-label={note.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-colors cursor-pointer ${
                note.isFavorite
                  ? 'text-[var(--accent-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Star
                className={`h-[18px] w-[18px] ${
                  note.isFavorite ? 'fill-[var(--accent-primary)]' : ''
                }`}
                strokeWidth={1.9}
              />
            </button>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="More note options"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                <MoreHorizontal className="h-5 w-5" strokeWidth={1.9} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-1.5 w-52 rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] py-1.5 z-40">
                  <button
                    type="button"
                    onClick={handleToggleLock}
                    className="flex w-full min-h-[42px] items-center justify-between px-4 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      {note.isLocked ? (
                        <Unlock className="h-4 w-4 text-[var(--accent-primary)]" strokeWidth={1.8} />
                      ) : (
                        <Lock className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.8} />
                      )}
                      {note.isLocked ? 'Remove Lock' : 'Lock Note'}
                    </span>
                    {!canUseNoteLock && (
                      <Lock className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setFolderPickerOpen(true);
                    }}
                    className="flex w-full min-h-[42px] items-center gap-2.5 px-4 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                  >
                    <FolderInput className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.8} />
                    Move to Folder
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      archiveNote(note.id);
                      navigate('home');
                    }}
                    className="flex w-full min-h-[42px] items-center gap-2.5 px-4 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                  >
                    <Archive className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.8} />
                    Archive Note
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setDeleteConfirmOpen(true);
                    }}
                    className="flex w-full min-h-[42px] items-center gap-2.5 px-4 text-sm text-[#E45B5B] hover:bg-[var(--bg-subtle)] cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                    Delete Note
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleBackOrDone}
              className="ml-1 min-h-[36px] px-3.5 rounded-full bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] text-xs font-semibold text-[var(--bg-card)] dark:text-[#171717] cursor-pointer"
            >
              Done
            </button>
          </div>
        </header>

        <RichTextEditor
          title={title}
          content={content}
          images={images}
          onChangeTitle={handleTitleChange}
          onChangeContent={handleContentChange}
          onChangeImages={handleImagesChange}
          autoFocusBody={mode === 'create'}
          initialCursorTarget={activeCursorTarget}
        />

        <FolderPickerDialog
          open={folderPickerOpen}
          folders={folders}
          selectedFolderId={note.folderId}
          onSelect={(fid) => moveNoteToFolder(note.id, fid)}
          onClose={() => setFolderPickerOpen(false)}
        />

        <ConfirmDialog
          open={deleteConfirmOpen}
          title="Move note to Trash?"
          description="You can restore this note later from the Trash screen."
          confirmLabel="Move to Trash"
          onConfirm={() => {
            deleteNote(note.id);
            navigate('home');
          }}
          onClose={() => setDeleteConfirmOpen(false)}
        />

        <LockMethodDialog
          open={lockMethodOpen}
          busy={biometricBusy}
          onSelectFingerprint={() => {
            void handleSelectFingerprintSetup();
          }}
          onSelectPin={() => {
            setLockMethodOpen(false);
            setPinCreateOpen(true);
          }}
          onClose={() => setLockMethodOpen(false)}
        />

        <PinDialog
          open={pinCreateOpen}
          mode="create"
          onSuccess={(newPin) => {
            setNotePin(newPin);
            toggleLockNote(note.id);
          }}
          onClose={() => setPinCreateOpen(false)}
        />
      </div>
    </NavigationShell>
  );
}
