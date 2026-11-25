import React, { useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { AppUpdateDialog } from './components/AppUpdateDialog';
import { UpgradePromptDialog } from './components/PinDialog';
import { NotesProvider, useNotes } from './context/NotesContext';
import {
  AppUpdateInfo,
  UpdateCheckOptions,
  checkForGitHubApkUpdate,
  dismissAppUpdateVersion,
  getCachedUpdateInfo,
} from './services/appUpdateService';
import { APP_UPDATE_NOTIFICATION_ID } from './utils/notificationHelper';
import { SplashScreen } from './screens/SplashScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { NotesHomeScreen } from './screens/NotesHomeScreen';
import { NoteEditorScreen } from './screens/NoteEditorScreen';
import { NoteDetailsScreen } from './screens/NoteDetailsScreen';
import { AllNotesScreen } from './screens/AllNotesScreen';
import { PinnedNotesScreen } from './screens/PinnedNotesScreen';
import { FavoriteNotesScreen } from './screens/FavoriteNotesScreen';
import { FoldersScreen } from './screens/FoldersScreen';
import { FolderDetailsScreen } from './screens/FolderDetailsScreen';
import { SearchScreen } from './screens/SearchScreen';
import { ArchiveScreen } from './screens/ArchiveScreen';
import { TrashScreen } from './screens/TrashScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AppearanceScreen } from './screens/AppearanceScreen';
import { AccountScreen } from './screens/AccountScreen';
import { PremiumScreen } from './screens/PremiumScreen';
import { HelpSupportScreen } from './screens/HelpSupportScreen';
import { AboutAppScreen } from './screens/AboutAppScreen';
import { AdminPanelScreen } from './screens/AdminPanelScreen';
import { CvGeneratorScreen } from './screens/CvGeneratorScreen';

function ScreenRouter() {
  const {
    screen,
    toast,
    dismissToast,
    upgradePromptReason,
    dismissUpgradePrompt,
    canViewSubscriptionPage,
    navigate,
  } = useNotes();

  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return;
    }

    let cancelled = false;
    const runCheck = async (options: UpdateCheckOptions) => {
      const info = await checkForGitHubApkUpdate(options);
      if (!cancelled && info) {
        setUpdateInfo(info);
      }
    };

    const timer = window.setTimeout(() => {
      void runCheck({ ignoreThrottle: true, respectDismissed: true });
    }, 800);

    const listenerPromise = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        void runCheck({ ignoreThrottle: false, respectDismissed: true });
      }
    });

    const notifListenerPromise = LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (event) => {
        const isUpdateNotif =
          event?.notification?.id === APP_UPDATE_NOTIFICATION_ID ||
          event?.notification?.extra?.type === 'app_update';
        if (!isUpdateNotif) return;

        void checkForGitHubApkUpdate({ ignoreThrottle: true, respectDismissed: false }).then((fresh) => {
          if (cancelled) return;
          if (fresh) {
            setUpdateInfo(fresh);
            return;
          }
          const cached = getCachedUpdateInfo();
          if (cached) {
            setUpdateInfo(cached);
          }
        });
      }
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      void listenerPromise.then((handle) => handle.remove()).catch(() => {});
      void notifListenerPromise.then((handle) => handle.remove()).catch(() => {});
    };
  }, []);

  const renderScreen = () => {
    switch (screen) {
      case 'splash':
        return <SplashScreen />;
      case 'onboarding':
        return <OnboardingScreen />;
      case 'home':
        return <NotesHomeScreen />;
      case 'create-note':
        return <NoteEditorScreen mode="create" />;
      case 'edit-note':
        return <NoteEditorScreen mode="edit" />;
      case 'note-details':
        return <NoteDetailsScreen />;
      case 'all-notes':
        return <AllNotesScreen />;
      case 'pinned-notes':
        return <PinnedNotesScreen />;
      case 'favorites':
        return <FavoriteNotesScreen />;
      case 'folders':
        return <FoldersScreen />;
      case 'folder-details':
        return <FolderDetailsScreen />;
      case 'search':
        return <SearchScreen />;
      case 'archive':
        return <ArchiveScreen />;
      case 'trash':
        return <TrashScreen />;
      case 'settings':
        return <SettingsScreen />;
      case 'appearance':
        return <AppearanceScreen />;
      case 'account':
        return <AccountScreen />;
      case 'premium':
        return canViewSubscriptionPage ? <PremiumScreen /> : <NotesHomeScreen />;
      case 'help':
        return <HelpSupportScreen />;
      case 'about':
        return <AboutAppScreen />;
      case 'admin':
        return <AdminPanelScreen />;
      case 'cv-generator':
        return <CvGeneratorScreen />;
      default:
        return <NotesHomeScreen />;
    }
  };

  return (
    <>
      {renderScreen()}

      {canViewSubscriptionPage && (
        <UpgradePromptDialog
          reason={upgradePromptReason}
          onUpgrade={() => navigate('premium')}
          onClose={dismissUpgradePrompt}
        />
      )}

      {screen !== 'splash' && (
        <AppUpdateDialog
          updateInfo={updateInfo}
          onDismiss={() => {
            if (updateInfo) {
              dismissAppUpdateVersion(updateInfo.latestVersion);
            }
            setUpdateInfo(null);
          }}
          onDownload={() => {
            if (updateInfo) {
              dismissAppUpdateVersion(updateInfo.latestVersion);
            }
            setUpdateInfo(null);
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-3 rounded-full bg-[#202124] dark:bg-[var(--bg-card)] border border-transparent dark:border-[var(--divider)] px-4 py-2 text-xs font-medium text-white dark:text-[var(--text-primary)] whitespace-nowrap">
            <button
              type="button"
              onClick={dismissToast}
              className="flex items-center gap-2 cursor-pointer"
            >
              {toast.variant === 'danger' ? (
                <AlertCircle className="h-3.5 w-3.5 text-[#E45B5B]" strokeWidth={2.2} />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent-primary)]" strokeWidth={2.2} />
              )}
              <span>{toast.text}</span>
            </button>

            {toast.undoAction && (
              <button
                type="button"
                onClick={() => {
                  const fn = toast.undoAction;
                  dismissToast();
                  fn?.();
                }}
                className="pl-2 border-l border-white/20 dark:border-[var(--divider)] font-semibold text-[#D9A928] hover:opacity-85 cursor-pointer"
              >
                Undo
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <NotesProvider>
      <ScreenRouter />
    </NotesProvider>
  );
}
