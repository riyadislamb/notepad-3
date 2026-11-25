import vintageStoryImg from '../assets/images/vintage_story_desk_1795192442584.jpg';
import { Folder, Note, UserAccount } from '../types/notes';

export const DEFAULT_MY_NOTES_FOLDER_ID = 'folder_my_notes_default';
export const CV_GENERATION_FOLDER_ID = 'folder_cv_generation_system';
export const FEATURED_STORY_NOTE_ID = 'note_featured_story_v1';

const SEEDED_TIMESTAMP = '2026-11-20T08:00:00.000Z';

export const DEFAULT_FOLDERS: Folder[] = [
  {
    id: DEFAULT_MY_NOTES_FOLDER_ID,
    name: 'My Notes',
    isDefault: true,
    createdAt: SEEDED_TIMESTAMP,
  },
  {
    id: CV_GENERATION_FOLDER_ID,
    name: 'Cv Generation',
    isDefault: true,
    isSystem: true,
    createdAt: SEEDED_TIMESTAMP,
  },
];

const FEATURED_STORY_HTML = [
  '<h2>পুরনো ডায়েরির পাতা ও সময়ের গল্প · A Story Written in Quiet Mornings</h2>',
  '<p><span style="font-size: 18px;">নভেম্বরের শান্ত ভোর। পুরনো কাঠের টেবিলের কোণে পড়ে থাকা চামড়ার মলাটের ডায়েরিটা খুলতেই যেন সময়ের ধুলো সরে গেল।</span> Every great idea begins with a <strong>single quiet thought</strong>—কখনো তা বাংলায়, কখনো <em>English</em>-এ, আবার কখনো জীবনের নানা রঙের অভিজ্ঞতায়।</p>',
  '<p>আগের দিনের <s>অগোছালো কাগজের টুকরো ও হারিয়ে যাওয়া স্মৃতি</s> এখন এক জায়গায় সাজানো থাকে। লেখার গুরুত্বপূর্ণ অংশগুলো <mark>হাইলাইট করে রাখা যায়</mark>, আর মনের গভীর অনুভূতির নিচে থাকে <u>স্পষ্ট আন্ডারলাইন ও যত্নের ছাপ</u>। <span style="font-size: 14px;">(ছোট-বড় যেকোনো ফন্ট সাইজেই নিজের মতো করে লেখা সাজানো যায়।)</span></p>',
  `<div class="note-image-block" contenteditable="false" data-image-block="true"><img src="${vintageStoryImg}" alt="Vintage leather journal and fountain pen on an oak desk" referrerpolicy="no-referrer" draggable="false" /><div class="note-image-controls"><button type="button" class="note-img-drag" data-action="drag-image" aria-label="Drag to move image"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg></button><button type="button" class="note-img-remove" data-action="remove-image" aria-label="Remove image"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></div></div>`,
  '<blockquote>“যে শব্দগুলো আজ লিখে রাখো, কাল সেগুলোই হয়ে ওঠে তোমার জীবনের সবচেয়ে মূল্যবান স্মৃতি।” — Write softly, remember deeply.</blockquote>',
  '<p><strong>ভ্রমণকারীর পুরনো ডায়েরিতে ছিল নানা ভাষার ছোঁয়া (Multilingual Memories):</strong></p>',
  '<ul><li><strong>বাংলা:</strong> প্রতিটি সকাল নতুন এক অধ্যায়ের শুরু।</li><li><strong>English:</strong> Quiet mornings turn fleeting ideas into lasting stories.</li><li><strong>हिन्दी:</strong> हर छोटा विचार एक बड़ी कहानी बन सकता है।</li><li><strong>العربية:</strong> الكلمات الصادقة تبقى في الذاكرة طويلاً.</li><li><strong>Español &amp; Français:</strong> <em>Cada día es una página nueva</em> · <em>Écrire, c’est garder le temps vivant.</em></li></ul>',
  '<hr />',
  '<p><strong>গল্পের শেষ অংশে ভ্রমণকারীর ৩টি নিয়ম (Journey Steps):</strong></p>',
  '<ol><li>প্রথমে মন খুলে ভাবনাগুলো লিখে ফেলুন, কোনো তাড়াহুড়ো ছাড়া।</li><li>জরুরি কাজ ও স্মৃতিগুলো Checklist ও Table দিয়ে গুছিয়ে নিন।</li><li>সবশেষে নিজের নোটের নিরাপদ Backup রাখুন—PDF বা Google Drive-এ।</li></ol>',
  '<p><strong>আজকের চেকলিস্ট (Interactive Checklist):</strong></p>',
  '<div class="note-check-item" data-checked="true"><span class="note-check-box" role="checkbox" aria-checked="true" tabindex="0"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span><span class="note-check-text">পুরনো ডায়েরির গল্পটি মন দিয়ে পড়া হয়েছে</span></div>',
  '<div class="note-check-item" data-checked="false"><span class="note-check-box" role="checkbox" aria-checked="false" tabindex="0"></span><span class="note-check-text">Write your own next chapter inside My Notes</span></div>',
  '<p><strong>গল্পের সময়রেখা (Story Timeline Table):</strong></p>',
  '<table class="note-table"><thead><tr><th>অধ্যায় / Chapter</th><th>ভাবনা / Memory</th><th>অবস্থা / Status</th></tr></thead><tbody><tr><td>ভোরের ডায়েরি</td><td>পুরনো কলম আর কাঠের টেবিল</td><td>সংরক্ষিত (Saved)</td></tr><tr><td>নতুন শুরু</td><td>Every note stays synced &amp; safe</td><td>চলমান (Active)</td></tr></tbody></table>',
  '<p>আরও জানতে বা আপনার সংরক্ষিত গল্পের ভুবনে ফিরে যেতে ভিজিট করুন: <a href="https://noted-b545a.firebaseapp.com" target="_blank" rel="noopener noreferrer">Notes Official Space</a>।</p>',
].join('');

export function createFeaturedStoryNote(folderId = DEFAULT_MY_NOTES_FOLDER_ID): Note {
  return {
    id: FEATURED_STORY_NOTE_ID,
    title: 'পুরনো ডায়েরির গল্প · A Timeless Story',
    content: FEATURED_STORY_HTML,
    folderId,
    isPinned: false,
    isFavorite: true,
    isArchived: false,
    isDeleted: false,
    createdAt: SEEDED_TIMESTAMP,
    updatedAt: SEEDED_TIMESTAMP,
  };
}

export const INITIAL_NOTES: Note[] = [createFeaturedStoryNote(DEFAULT_MY_NOTES_FOLDER_ID)];

export const INITIAL_ACCOUNT: UserAccount = {
  name: 'Guest Account',
  email: '',
  photoUrl: '',
  emailVerified: false,
  isGuest: true,
};

export const INITIAL_RECENT_SEARCHES: string[] = [];
