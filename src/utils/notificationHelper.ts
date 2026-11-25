import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { NotificationSettings } from '../types/notes';

const DAILY_REMINDER_ID = 1001;
const WEEKLY_DIGEST_ID = 1002;
const CHANNEL_ID = 'notes_reminders';

function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function ensureChannel(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Notes Reminders',
      description: 'Daily writing prompts and weekly note summaries',
      importance: 3,
      visibility: 1,
    });
  } catch {
    // Ignore channel errors on unsupported platforms
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (isNativePlatform()) {
    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display === 'granted') return true;
      const requested = await LocalNotifications.requestPermissions();
      return requested.display === 'granted';
    } catch {
      return false;
    }
  }

  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try {
      const result = await Notification.requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }

  return true;
}

export async function syncLocalNotifications(
  settings: NotificationSettings,
  requestIfNeeded = false
): Promise<{ permissionGranted: boolean }> {
  const needsAnyNotification = settings.dailyReminder || settings.weeklyDigest;

  if (isNativePlatform()) {
    try {
      if (needsAnyNotification) {
        const current = await LocalNotifications.checkPermissions();
        let granted = current.display === 'granted';
        if (!granted && requestIfNeeded) {
          const req = await LocalNotifications.requestPermissions();
          granted = req.display === 'granted';
        }
        if (!granted) {
          return { permissionGranted: false };
        }
      }

      await ensureChannel();

      const idsToCancel: Array<{ id: number }> = [];
      if (!settings.dailyReminder) idsToCancel.push({ id: DAILY_REMINDER_ID });
      if (!settings.weeklyDigest) idsToCancel.push({ id: WEEKLY_DIGEST_ID });
      if (idsToCancel.length > 0) {
        await LocalNotifications.cancel({ notifications: idsToCancel });
      }

      const toSchedule: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = [];

      if (settings.dailyReminder) {
        toSchedule.push({
          id: DAILY_REMINDER_ID,
          title: 'Daily Writing Reminder',
          body: 'Take a quiet moment to jot down today’s thoughts in Notes.',
          channelId: CHANNEL_ID,
          isExactNotification: false,
          schedule: {
            on: { hour: 20, minute: 0 },
            allowWhileIdle: true,
          },
        });
      }

      if (settings.weeklyDigest) {
        toSchedule.push({
          id: WEEKLY_DIGEST_ID,
          title: 'Weekly Notes Recap',
          body: 'Review and organize your pinned and recent notes for the week.',
          channelId: CHANNEL_ID,
          isExactNotification: false,
          schedule: {
            on: { weekday: 1, hour: 19, minute: 0 },
            allowWhileIdle: true,
          },
        });
      }

      if (toSchedule.length > 0) {
        await LocalNotifications.cancel({
          notifications: toSchedule.map((n) => ({ id: n.id })),
        });
        await LocalNotifications.schedule({ notifications: toSchedule });
      }

      return { permissionGranted: true };
    } catch {
      return { permissionGranted: false };
    }
  }

  // Web browser fallback
  if (needsAnyNotification && requestIfNeeded) {
    const granted = await requestNotificationPermission();
    return { permissionGranted: granted };
  }

  return { permissionGranted: true };
}

export const APP_UPDATE_NOTIFICATION_ID = 2001;
const UPDATE_CHANNEL_ID = 'notes_app_updates';

async function ensureUpdateChannel(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: UPDATE_CHANNEL_ID,
      name: 'App Updates',
      description: 'Notifications when a new version of Notes is available',
      importance: 4,
      visibility: 1,
    });
  } catch {
    // Ignore channel errors on unsupported platforms
  }
}

export async function notifyAppUpdateStatusBar(
  latestVersion: string,
  downloadUrl: string
): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const current = await LocalNotifications.checkPermissions();
    let granted = current.display === 'granted';
    if (!granted) {
      const req = await LocalNotifications.requestPermissions();
      granted = req.display === 'granted';
    }
    if (!granted) return false;

    await ensureUpdateChannel();
    await LocalNotifications.cancel({
      notifications: [{ id: APP_UPDATE_NOTIFICATION_ID }],
    });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: APP_UPDATE_NOTIFICATION_ID,
          title: `Notes Update Available (v${latestVersion})`,
          body: 'A new APK version is ready to download. Tap to update.',
          channelId: UPDATE_CHANNEL_ID,
          foreground: true,
          isExactNotification: false,
          extra: {
            type: 'app_update',
            version: latestVersion,
            downloadUrl,
          },
        },
      ],
    });
    return true;
  } catch {
    return false;
  }
}

export async function clearAppUpdateStatusBarNotification(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({
      notifications: [{ id: APP_UPDATE_NOTIFICATION_ID }],
    });
    await LocalNotifications.removeDeliveredNotificationsById({
      ids: [APP_UPDATE_NOTIFICATION_ID],
    });
  } catch {
    // Ignore cleanup errors
  }
}
