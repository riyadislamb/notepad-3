import { Capacitor } from '@capacitor/core';
import {
  BiometricAuthError,
  BiometryType,
  NativeBiometric,
} from '@capgo/capacitor-native-biometric';

export interface BiometricStatus {
  available: boolean;
  biometryType: BiometryType;
  label: string;
}

export function getBiometryLabel(type: BiometryType): string {
  switch (type) {
    case BiometryType.FINGERPRINT:
    case BiometryType.TOUCH_ID:
      return 'Fingerprint';
    case BiometryType.FACE_ID:
    case BiometryType.FACE_AUTHENTICATION:
      return 'Face Unlock';
    case BiometryType.IRIS_AUTHENTICATION:
      return 'Iris Unlock';
    case BiometryType.MULTIPLE:
      return 'Biometrics';
    default:
      return 'Fingerprint';
  }
}

export async function checkBiometricAvailability(): Promise<BiometricStatus> {
  if (!Capacitor.isNativePlatform()) {
    return {
      available: false,
      biometryType: BiometryType.NONE,
      label: 'Fingerprint',
    };
  }

  try {
    const result = await NativeBiometric.isAvailable();
    if (!result.isAvailable) {
      return {
        available: false,
        biometryType: BiometryType.NONE,
        label: 'Fingerprint',
      };
    }
    return {
      available: true,
      biometryType: result.biometryType,
      label: getBiometryLabel(result.biometryType),
    };
  } catch {
    return {
      available: false,
      biometryType: BiometryType.NONE,
      label: 'Fingerprint',
    };
  }
}

export async function subscribeBiometryChange(
  onChange: (status: BiometricStatus) => void
): Promise<(() => void) | null> {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    const handle = await NativeBiometric.addListener('biometryChange', (result) => {
      onChange({
        available: Boolean(result.isAvailable),
        biometryType: result.biometryType,
        label: getBiometryLabel(result.biometryType),
      });
    });
    return () => {
      void handle.remove().catch(() => {});
    };
  } catch {
    return null;
  }
}

export async function verifyBiometricIdentity(options?: {
  title?: string;
  subtitle?: string;
  reason?: string;
  description?: string;
  negativeButtonText?: string;
}): Promise<{ verified: boolean; cancelled?: boolean; errorMessage?: string }> {
  if (!Capacitor.isNativePlatform()) {
    return {
      verified: false,
      errorMessage: 'Biometric unlock is available on mobile devices.',
    };
  }

  try {
    await NativeBiometric.verifyIdentity({
      title: options?.title || 'Unlock Locked Note',
      subtitle: options?.subtitle || 'Confirm your identity',
      reason: options?.reason || 'Authenticate to view this locked note',
      description: options?.description || 'Use your fingerprint or biometrics to unlock',
      negativeButtonText: options?.negativeButtonText || 'Cancel',
      maxAttempts: 3,
    });
    return { verified: true };
  } catch (err) {
    const errObj = err as { code?: number | string; message?: string };
    const numericCode =
      typeof errObj?.code === 'number'
        ? errObj.code
        : Number.isFinite(Number(errObj?.code))
        ? Number(errObj.code)
        : undefined;
    const msg = (errObj?.message || '').toLowerCase();

    if (
      numericCode === BiometricAuthError.USER_CANCEL ||
      numericCode === BiometricAuthError.USER_FALLBACK ||
      numericCode === BiometricAuthError.SYSTEM_CANCEL ||
      numericCode === BiometricAuthError.APP_CANCEL ||
      msg.includes('cancel') ||
      msg.includes('use pin')
    ) {
      return { verified: false, cancelled: true };
    }

    if (
      numericCode === BiometricAuthError.USER_LOCKOUT ||
      numericCode === BiometricAuthError.USER_TEMPORARY_LOCKOUT
    ) {
      return {
        verified: false,
        errorMessage: 'Too many biometric attempts. Enter your 4-digit PIN.',
      };
    }

    return {
      verified: false,
      errorMessage: 'Biometric verification failed. Use your 4-digit PIN.',
    };
  }
}
