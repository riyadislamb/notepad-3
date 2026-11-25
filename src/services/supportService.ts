import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { SupportMessage } from '../types/notes';
import { ADMIN_EMAIL } from './adminConfigService';
import { auth, db, isFirebaseConfigured } from './googleAuthDrive';

const SUPPORT_COLLECTION = 'support_messages';

function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
  return `${base}${path}`;
}

export function buildSupportReplyMailto(ticket: SupportMessage, replyText: string): string {
  const subject = ticket.subject.toLowerCase().startsWith('re:')
    ? ticket.subject
    : `Re: ${ticket.subject}`;
  const body = [
    `Hi ${ticket.userName || 'User'},`,
    '',
    replyText.trim(),
    '',
    '---',
    `Your message: ${ticket.message}`,
    '',
    'Notes Support',
  ].join('\n');

  return `mailto:${encodeURIComponent(ticket.userEmail)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}

export async function submitSupportMessage(params: {
  userEmail: string;
  userName: string;
  userUid?: string;
  subject: string;
  message: string;
}): Promise<string> {
  const userEmail = params.userEmail.trim().toLowerCase();
  const subject = params.subject.trim();
  const message = params.message.trim();

  if (!userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
    throw new Error('Please enter a valid email address so we can reply to you.');
  }
  if (!subject || !message) {
    throw new Error('Please enter both subject and message.');
  }
  if (!isFirebaseConfigured || !db) {
    throw new Error('Support service is unavailable right now.');
  }

  const now = new Date().toISOString();
  const docRef = await addDoc(collection(db, SUPPORT_COLLECTION), {
    userEmail,
    userName: params.userName.trim() || 'Notes User',
    userUid: params.userUid || null,
    subject,
    message,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  });

  return docRef.id;
}

export function subscribeSupportMessages(
  onUpdate: (messages: SupportMessage[]) => void,
  onError?: (errorMessage: string) => void
): () => void {
  if (!isFirebaseConfigured || !db) {
    onUpdate([]);
    return () => {};
  }

  try {
    const q = query(collection(db, SUPPORT_COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const items: SupportMessage[] = snapshot.docs.map((snap) => {
          const d = snap.data() as Partial<SupportMessage>;
          return {
            id: snap.id,
            userEmail: String(d.userEmail || ''),
            userName: String(d.userName || 'Notes User'),
            userUid: typeof d.userUid === 'string' ? d.userUid : undefined,
            subject: String(d.subject || 'Support Request'),
            message: String(d.message || ''),
            status: d.status === 'replied' ? 'replied' : 'open',
            adminReply: typeof d.adminReply === 'string' ? d.adminReply : undefined,
            repliedAt: typeof d.repliedAt === 'string' ? d.repliedAt : undefined,
            repliedBy: typeof d.repliedBy === 'string' ? d.repliedBy : undefined,
            emailDeliveryStatus:
              d.emailDeliveryStatus === 'sent' ||
              d.emailDeliveryStatus === 'mailto_fallback' ||
              d.emailDeliveryStatus === 'not_configured'
                ? d.emailDeliveryStatus
                : undefined,
            createdAt: String(d.createdAt || ''),
            updatedAt: String(d.updatedAt || d.createdAt || ''),
          };
        });
        onUpdate(items);
      },
      (err) => {
        onError?.(err?.message || 'Could not load support messages.');
      }
    );
  } catch (err) {
    onError?.(err instanceof Error ? err.message : 'Support sync failed.');
    return () => {};
  }
}

export async function replyToSupportMessage(
  ticket: SupportMessage,
  rawReply: string
): Promise<{ emailSent: boolean; smtpConfigured: boolean; statusMessage: string }> {
  const replyText = rawReply.trim();
  if (!replyText) {
    throw new Error('Please write a reply first.');
  }
  if (!isFirebaseConfigured || !db || !auth?.currentUser) {
    throw new Error('Sign in with your admin Google account first.');
  }

  const currentEmail = (auth.currentUser.email || '').trim().toLowerCase();
  if (currentEmail !== ADMIN_EMAIL || !auth.currentUser.emailVerified) {
    throw new Error('Only the verified admin account can reply.');
  }

  let emailSent = false;
  let smtpConfigured = false;
  let serverError = '';

  try {
    const idToken = await auth.currentUser.getIdToken();
    const res = await fetch(apiUrl('/api/support/reply'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        toEmail: ticket.userEmail,
        userName: ticket.userName,
        subject: ticket.subject,
        originalMessage: ticket.message,
        replyText,
        ticketId: ticket.id,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      sent?: boolean;
      configured?: boolean;
      error?: string;
    };
    emailSent = Boolean(res.ok && data.sent);
    smtpConfigured = Boolean(data.configured);
    if (!emailSent && data.error) {
      serverError = data.error;
    }
  } catch {
    emailSent = false;
    smtpConfigured = false;
  }

  const now = new Date().toISOString();
  await updateDoc(doc(db, SUPPORT_COLLECTION, ticket.id), {
    status: 'replied',
    adminReply: replyText,
    repliedAt: now,
    repliedBy: ADMIN_EMAIL,
    emailDeliveryStatus: emailSent
      ? 'sent'
      : smtpConfigured
      ? 'mailto_fallback'
      : 'not_configured',
    updatedAt: now,
  });

  if (emailSent) {
    return {
      emailSent: true,
      smtpConfigured: true,
      statusMessage: `Reply emailed to ${ticket.userEmail}`,
    };
  }

  return {
    emailSent: false,
    smtpConfigured,
    statusMessage: serverError
      ? `Reply saved. ${serverError}`
      : `Reply saved. Tap "Send via Email App" to email ${ticket.userEmail}.`,
  };
}
