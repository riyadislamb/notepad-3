import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { jsPDF } from 'jspdf';
import { CvData } from '../types/notes';

export const CV_DRAFT_STORAGE_KEY = 'notes_cv_generator_draft_v1';

export const DEFAULT_CAREER_OBJECTIVE =
  'A motivated, responsible, and hardworking individual seeking opportunities to utilize my knowledge, skills, and creativity. I am eager to learn new things, take on challenges, and contribute positively to an organization, educational institution, or professional project.';

export const DEFAULT_DECLARATION =
  'I hereby declare that all the information provided above is true and correct to the best of my knowledge and belief.';

export const FRESHER_EXPERIENCE_TEXT =
  'No formal work experience yet, but eager to learn and develop professional skills.';

export const CV_SKILL_OPTIONS = [
  'Communication Skills',
  'Computer Literacy',
  'Microsoft Word, Excel & PowerPoint',
  'Internet & Email Management',
  'Problem Solving',
  'Time Management',
  'Teamwork & Leadership',
  'Creativity & Adaptability',
] as const;

export const CV_INTEREST_OPTIONS = [
  'Reading and Learning',
  'Technology',
  'Creative Activities',
  'Professional Development',
] as const;

export const CV_ENGLISH_LEVELS = ['Basic', 'Intermediate', 'Fluent'] as const;

export function createDefaultCvData(): CvData {
  return {
    fullName: '',
    phone: '',
    email: '',
    address: '',
    portfolioLink: '',
    careerObjective: DEFAULT_CAREER_OBJECTIVE,
    fathersName: '',
    mothersName: '',
    dateOfBirth: '',
    nationality: '',
    gender: '',
    maritalStatus: '',
    educations: [
      { id: 'edu_1', qualification: '', institution: '', board: '', year: '', result: '' },
      { id: 'edu_2', qualification: '', institution: '', board: '', year: '', result: '' },
    ],
    skills: [],
    isFresher: false,
    experiences: [
      {
        id: 'exp_1',
        jobTitle: '',
        company: '',
        duration: '',
        responsibility: '',
        achievements: '',
      },
    ],
    projects: ['', ''],
    certificates: '',
    englishLevel: 'Intermediate',
    otherLanguage: '',
    interests: [...CV_INTEREST_OPTIONS],
    signatureText: '',
    declarationDate: '',
  };
}

export function loadCvDraft(): CvData {
  const defaults = createDefaultCvData();
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(CV_DRAFT_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<CvData>;
    return {
      ...defaults,
      ...parsed,
      educations:
        Array.isArray(parsed.educations) && parsed.educations.length > 0
          ? parsed.educations
          : defaults.educations,
      skills: Array.isArray(parsed.skills) ? parsed.skills : defaults.skills,
      experiences:
        Array.isArray(parsed.experiences) && parsed.experiences.length > 0
          ? parsed.experiences
          : defaults.experiences,
      projects:
        Array.isArray(parsed.projects) && parsed.projects.length > 0
          ? parsed.projects
          : defaults.projects,
      interests: Array.isArray(parsed.interests) ? parsed.interests : defaults.interests,
      englishLevel:
        parsed.englishLevel === 'Basic' ||
        parsed.englishLevel === 'Intermediate' ||
        parsed.englishLevel === 'Fluent'
          ? parsed.englishLevel
          : 'Intermediate',
    };
  } catch {
    return defaults;
  }
}

export function saveCvDraft(data: CvData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CV_DRAFT_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

function esc(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildCvNoteHtml(data: CvData): string {
  const name = data.fullName.trim() || 'YOUR FULL NAME';
  const contactParts: string[] = [];
  if (data.phone.trim()) contactParts.push(`Phone: ${esc(data.phone.trim())}`);
  if (data.email.trim()) contactParts.push(`Email: ${esc(data.email.trim())}`);
  if (data.address.trim()) contactParts.push(`Address: ${esc(data.address.trim())}`);
  if (data.portfolioLink.trim()) {
    contactParts.push(`Portfolio / LinkedIn: ${esc(data.portfolioLink.trim())}`);
  }

  const filledEducations = data.educations.filter(
    (e) =>
      e.qualification.trim() ||
      e.institution.trim() ||
      e.board.trim() ||
      e.year.trim() ||
      e.result.trim()
  );

  const eduRowsHtml = (filledEducations.length > 0 ? filledEducations : data.educations)
    .map(
      (e) =>
        `<tr><td>${esc(e.qualification || '—')}</td><td>${esc(e.institution || '—')}</td><td>${esc(
          e.board || '—'
        )}</td><td>${esc(e.year || '—')}</td><td>${esc(e.result || '—')}</td></tr>`
    )
    .join('');

  const skillsHtml =
    data.skills.length > 0
      ? `<ul>${data.skills.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`
      : '<p>No skills selected yet.</p>';

  let expHtml = '';
  if (data.isFresher) {
    expHtml = `<p><strong>Fresher:</strong> ${esc(FRESHER_EXPERIENCE_TEXT)}</p>`;
  } else {
    const validExp = data.experiences.filter(
      (x) =>
        x.jobTitle.trim() ||
        x.company.trim() ||
        x.duration.trim() ||
        x.responsibility.trim() ||
        x.achievements.trim()
    );
    if (validExp.length === 0) {
      expHtml = `<p>${esc(FRESHER_EXPERIENCE_TEXT)}</p>`;
    } else {
      expHtml = validExp
        .map((x) => {
          const items: string[] = [];
          if (x.responsibility.trim()) items.push(`<li>${esc(x.responsibility.trim())}</li>`);
          if (x.achievements.trim()) items.push(`<li>${esc(x.achievements.trim())}</li>`);
          return [
            `<p><strong>${esc(x.jobTitle.trim() || 'Position')}</strong></p>`,
            x.company.trim()
              ? `<p>Company / Institution: ${esc(x.company.trim())}</p>`
              : '',
            x.duration.trim() ? `<p>Duration: ${esc(x.duration.trim())}</p>` : '',
            items.length > 0 ? `<ul>${items.join('')}</ul>` : '',
          ].join('');
        })
        .join('');
    }
  }

  const projectItems = [
    ...data.projects.map((p) => p.trim()).filter(Boolean),
    ...(data.certificates.trim() ? [`Certificates / Awards: ${data.certificates.trim()}`] : []),
  ];

  const personalLines = [
    data.fathersName.trim() ? `<li>Father's Name: ${esc(data.fathersName.trim())}</li>` : '',
    data.mothersName.trim() ? `<li>Mother's Name: ${esc(data.mothersName.trim())}</li>` : '',
    data.dateOfBirth.trim() ? `<li>Date of Birth: ${esc(data.dateOfBirth.trim())}</li>` : '',
    data.nationality.trim() ? `<li>Nationality: ${esc(data.nationality.trim())}</li>` : '',
    data.gender.trim() ? `<li>Gender: ${esc(data.gender.trim())}</li>` : '',
    data.maritalStatus.trim() ? `<li>Marital Status: ${esc(data.maritalStatus.trim())}</li>` : '',
  ]
    .filter(Boolean)
    .join('');

  return [
    `<h2>CURRICULUM VITAE — ${esc(name)}</h2>`,
    contactParts.length > 0 ? `<p>${contactParts.join(' · ')}</p>` : '',
    '<hr />',
    '<h2>CAREER OBJECTIVE</h2>',
    `<p>${esc(data.careerObjective.trim() || DEFAULT_CAREER_OBJECTIVE)}</p>`,
    personalLines ? `<h2>PERSONAL INFORMATION</h2><ul>${personalLines}</ul>` : '',
    '<h2>EDUCATIONAL QUALIFICATIONS</h2>',
    `<table class="note-table"><thead><tr><th>Qualification</th><th>Institution</th><th>Board</th><th>Year</th><th>Result</th></tr></thead><tbody>${eduRowsHtml}</tbody></table>`,
    '<h2>SKILLS</h2>',
    skillsHtml,
    '<h2>WORK EXPERIENCE</h2>',
    expHtml,
    projectItems.length > 0
      ? `<h2>PROJECTS &amp; ACHIEVEMENTS</h2><ul>${projectItems
          .map((item) => `<li>${esc(item)}</li>`)
          .join('')}</ul>`
      : '',
    '<h2>LANGUAGES</h2>',
    `<ul><li>Bengali: Native</li><li>English: ${esc(data.englishLevel)}</li>${
      data.otherLanguage.trim() ? `<li>Other: ${esc(data.otherLanguage.trim())}</li>` : ''
    }</ul>`,
    data.interests.length > 0
      ? `<h2>INTERESTS</h2><ul>${data.interests.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
      : '',
    '<h2>REFERENCES</h2>',
    '<p>Available upon request.</p>',
    '<h2>DECLARATION</h2>',
    `<p>${esc(DEFAULT_DECLARATION)}</p>`,
    `<p>Signature: ${esc(data.signatureText.trim() || '__________________')} &nbsp;&nbsp; Date: ${esc(
      data.declarationDate.trim() || '__________________'
    )}</p>`,
  ]
    .filter(Boolean)
    .join('');
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

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function sanitizeFileName(raw: string, fallback: string): string {
  const cleaned = raw
    .replace(/[/\\:*?"<>|\r\n\t]+/g, ' ')
    .replace(/\s+/g, '_')
    .trim()
    .slice(0, 64);
  return cleaned || fallback;
}

function formatTodayDate(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export async function renderCvToPdfBytes(data: CvData): Promise<Uint8Array> {
  const pageWidthPx = 1240;
  const pageHeightPx = 1754;
  const marginX = 76;
  const marginTop = 60;
  const marginBottom = 58;
  const contentWidth = pageWidthPx - marginX * 2;
  const fontFamily = '"Plus Jakarta Sans", "Noto Sans Bengali", system-ui, -apple-system, sans-serif';

  const brandNavy = '#1E3A5F';
  const brandTint = '#F8FAFC';
  const inkDark = '#0F172A';
  const inkBody = '#1F2937';
  const inkMuted = '#475569';
  const ruleColor = '#CBD5E1';

  const runDrawPass = (paginated: boolean) => {
    const canvases: HTMLCanvasElement[] = [];

    const createCanvasPage = (isFirstPage: boolean) => {
      const canvas = document.createElement('canvas');
      canvas.width = pageWidthPx;
      canvas.height = paginated ? pageHeightPx : 3600;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Crisp executive top accent strip
      ctx.fillStyle = brandNavy;
      ctx.fillRect(0, 0, pageWidthPx, isFirstPage ? 10 : 6);

      canvases.push(canvas);
      return { canvas, ctx, y: marginTop };
    };

    let page = createCanvasPage(true);

    const ensureSpace = (needed: number) => {
      if (paginated && page.y + needed > pageHeightPx - marginBottom) {
        page = createCanvasPage(false);
      }
    };

    const drawTextLines = (
      text: string,
      opts: {
        font: string;
        color: string;
        lineHeight: number;
        x?: number;
        maxWidth?: number;
        align?: 'left' | 'center';
      }
    ) => {
      const x = opts.x ?? marginX;
      const maxW = opts.maxWidth ?? contentWidth;
      page.ctx.font = opts.font;
      const lines = wrapCanvasText(page.ctx, text, maxW);
      for (const line of lines) {
        ensureSpace(opts.lineHeight);
        page.ctx.font = opts.font;
        page.ctx.fillStyle = opts.color;
        if (opts.align === 'center') {
          const w = page.ctx.measureText(line).width;
          page.ctx.fillText(line, marginX + Math.max(0, (contentWidth - w) / 2), page.y);
        } else {
          page.ctx.fillText(line, x, page.y);
        }
        page.y += opts.lineHeight;
      }
    };

    const drawTextLinesAt = (
      text: string,
      startY: number,
      opts: {
        font: string;
        color: string;
        lineHeight: number;
        x: number;
        maxWidth: number;
      }
    ): number => {
      let localY = startY;
      page.ctx.font = opts.font;
      const lines = wrapCanvasText(page.ctx, text, opts.maxWidth);
      for (const line of lines) {
        page.ctx.font = opts.font;
        page.ctx.fillStyle = opts.color;
        page.ctx.fillText(line, opts.x, localY);
        localY += opts.lineHeight;
      }
      return localY;
    };

    const drawSectionHeading = (title: string) => {
      ensureSpace(64);
      page.y += 14;
      page.ctx.fillStyle = brandNavy;
      page.ctx.fillRect(marginX, page.y - 16, 4.5, 19);

      page.ctx.font = `700 18.5px ${fontFamily}`;
      page.ctx.fillStyle = brandNavy;
      page.ctx.fillText(title, marginX + 14, page.y);

      page.y += 9;
      page.ctx.fillStyle = ruleColor;
      page.ctx.fillRect(marginX, page.y, contentWidth, 1.5);
      page.y += 24;
    };

    const drawSectionHeadingAt = (
      title: string,
      startY: number,
      x: number,
      width: number
    ): number => {
      let localY = startY + 14;
      page.ctx.fillStyle = brandNavy;
      page.ctx.fillRect(x, localY - 16, 4.5, 19);

      page.ctx.font = `700 18.5px ${fontFamily}`;
      page.ctx.fillStyle = brandNavy;
      page.ctx.fillText(title, x + 14, localY);

      localY += 9;
      page.ctx.fillStyle = ruleColor;
      page.ctx.fillRect(x, localY, width, 1.5);
      return localY + 24;
    };

    // Header Background Band
    const todayStr = formatTodayDate();
    const headerStartY = page.y - 26;
    const contactRow1: string[] = [];
    if (data.phone.trim()) contactRow1.push(`Phone: ${data.phone.trim()}`);
    if (data.email.trim()) contactRow1.push(`Email: ${data.email.trim()}`);

    const contactRow2: string[] = [];
    if (data.address.trim()) contactRow2.push(`Address: ${data.address.trim()}`);
    if (data.portfolioLink.trim()) contactRow2.push(`Portfolio: ${data.portfolioLink.trim()}`);

    // Measure header lines to draw subtle executive background
    page.ctx.font = `700 34px ${fontFamily}`;
    const nameLines = wrapCanvasText(
      page.ctx,
      (data.fullName.trim() || 'YOUR FULL NAME').toUpperCase(),
      contentWidth - 32
    );
    const estHeaderHeight =
      76 +
      nameLines.length * 42 +
      (contactRow1.length > 0 ? 28 : 0) +
      (contactRow2.length > 0 ? 28 : 0) +
      24;

    page.ctx.fillStyle = brandTint;
    page.ctx.fillRect(marginX - 16, headerStartY, contentWidth + 32, estHeaderHeight);

    // Today's Date on top-right side of page
    page.ctx.font = `500 15.5px ${fontFamily}`;
    page.ctx.fillStyle = inkMuted;
    const todayLabel = `Date: ${todayStr}`;
    const todayW = page.ctx.measureText(todayLabel).width;
    page.ctx.fillText(todayLabel, pageWidthPx - marginX - todayW, page.y - 4);
    page.y += 18;

    drawTextLines('CURRICULUM VITAE', {
      font: `700 21px ${fontFamily}`,
      color: brandNavy,
      lineHeight: 28,
      align: 'center',
    });

    page.y += 14;
    drawTextLines((data.fullName.trim() || 'YOUR FULL NAME').toUpperCase(), {
      font: `700 34px ${fontFamily}`,
      color: inkDark,
      lineHeight: 42,
      align: 'center',
    });

    page.y += 4;
    if (contactRow1.length > 0) {
      drawTextLines(contactRow1.join('   •   '), {
        font: `500 18px ${fontFamily}`,
        color: inkMuted,
        lineHeight: 27,
        align: 'center',
      });
    }

    if (contactRow2.length > 0) {
      drawTextLines(contactRow2.join('   •   '), {
        font: `400 17.5px ${fontFamily}`,
        color: inkMuted,
        lineHeight: 26,
        align: 'center',
      });
    }

    page.y = Math.max(page.y + 8, headerStartY + estHeaderHeight);
    page.ctx.fillStyle = brandNavy;
    page.ctx.fillRect(marginX - 16, page.y, contentWidth + 32, 2.5);
    page.y += 14;

    // Career Objective
    drawSectionHeading('CAREER OBJECTIVE');
    drawTextLines(data.careerObjective.trim() || DEFAULT_CAREER_OBJECTIVE, {
      font: `400 18.5px ${fontFamily}`,
      color: inkBody,
      lineHeight: 27,
    });

    // Personal Information (2-column grid with bold labels)
    const personalRows: [string, string][] = [
      ["Father's Name", data.fathersName.trim()],
      ["Mother's Name", data.mothersName.trim()],
      ['Date of Birth', data.dateOfBirth.trim()],
      ['Nationality', data.nationality.trim()],
      ['Gender', data.gender.trim()],
      ['Marital Status', data.maritalStatus.trim()],
    ].filter(([, val]) => Boolean(val)) as [string, string][];

    if (personalRows.length > 0) {
      drawSectionHeading('PERSONAL INFORMATION');
      const colGap = 40;
      const colWidth = Math.floor((contentWidth - colGap) / 2);

      for (let i = 0; i < personalRows.length; i += 2) {
        ensureSpace(32);
        const [leftLabel, leftVal] = personalRows[i];
        const rightPair = personalRows[i + 1];

        const drawPair = (label: string, val: string, xPos: number): number => {
          page.ctx.font = `600 18px ${fontFamily}`;
          const labelText = `${label}: `;
          const labelW = page.ctx.measureText(labelText).width;
          page.ctx.fillStyle = inkDark;
          page.ctx.fillText(labelText, xPos, page.y);
          return drawTextLinesAt(val, page.y, {
            font: `400 18px ${fontFamily}`,
            color: inkBody,
            lineHeight: 27,
            x: xPos + labelW,
            maxWidth: Math.max(120, colWidth - labelW),
          });
        };

        const leftEnd = drawPair(leftLabel, leftVal, marginX);
        let rightEnd = leftEnd;
        if (rightPair) {
          rightEnd = drawPair(rightPair[0], rightPair[1], marginX + colWidth + colGap);
        }
        page.y = Math.max(leftEnd, rightEnd);
      }
      page.y += 4;
    }

    // Educational Qualifications Table
    const validEducations = data.educations.filter(
      (e) =>
        e.qualification.trim() ||
        e.institution.trim() ||
        e.board.trim() ||
        e.year.trim() ||
        e.result.trim()
    );
    if (validEducations.length > 0) {
      drawSectionHeading('EDUCATIONAL QUALIFICATIONS');
      const colWidths = [
        Math.round(contentWidth * 0.2),
        Math.round(contentWidth * 0.3),
        Math.round(contentWidth * 0.22),
        Math.round(contentWidth * 0.12),
        contentWidth -
          Math.round(contentWidth * 0.2) -
          Math.round(contentWidth * 0.3) -
          Math.round(contentWidth * 0.22) -
          Math.round(contentWidth * 0.12),
      ];

      const tableRows = [
        {
          cells: ['Qualification', 'Institution', 'Board', 'Year', 'Result'],
          isHeader: true,
        },
        ...validEducations.map((e) => ({
          cells: [
            e.qualification.trim() || '—',
            e.institution.trim() || '—',
            e.board.trim() || '—',
            e.year.trim() || '—',
            e.result.trim() || '—',
          ],
          isHeader: false,
        })),
      ];

      const cellPadX = 12;
      const cellPadY = 10;
      const rowLineH = 24;

      for (let rIdx = 0; rIdx < tableRows.length; rIdx += 1) {
        const row = tableRows[rIdx];
        page.ctx.font = row.isHeader ? `700 17.5px ${fontFamily}` : `400 17.5px ${fontFamily}`;
        const wrappedCols = row.cells.map((cell, i) =>
          wrapCanvasText(page.ctx, cell, colWidths[i] - cellPadX * 2)
        );
        const maxLines = Math.max(1, ...wrappedCols.map((l) => l.length));
        const rowH = maxLines * rowLineH + cellPadY * 2;
        ensureSpace(rowH + 6);

        let curX = marginX;
        for (let i = 0; i < row.cells.length; i += 1) {
          const w = colWidths[i];
          if (row.isHeader) {
            page.ctx.fillStyle = brandNavy;
            page.ctx.fillRect(curX, page.y - 19, w, rowH);
          } else if (rIdx % 2 === 0) {
            page.ctx.fillStyle = brandTint;
            page.ctx.fillRect(curX, page.y - 19, w, rowH);
          }

          page.ctx.strokeStyle = row.isHeader ? brandNavy : '#E2E8F0';
          page.ctx.lineWidth = 1;
          page.ctx.strokeRect(curX, page.y - 19, w, rowH);

          page.ctx.font = row.isHeader ? `700 17.5px ${fontFamily}` : `400 17.5px ${fontFamily}`;
          page.ctx.fillStyle = row.isHeader ? '#FFFFFF' : inkBody;
          wrappedCols[i].forEach((line, lineIdx) => {
            page.ctx.fillText(line, curX + cellPadX, page.y + cellPadY - 3 + lineIdx * rowLineH);
          });
          curX += w;
        }
        page.y += rowH;
      }
      page.y += 6;
    }

    // Skills (2-column clean list)
    if (data.skills.length > 0) {
      drawSectionHeading('SKILLS');
      const colGap = 40;
      const colW = Math.floor((contentWidth - colGap) / 2);
      for (let i = 0; i < data.skills.length; i += 2) {
        const leftSkill = data.skills[i];
        const rightSkill = data.skills[i + 1] || '';
        page.ctx.font = `500 18px ${fontFamily}`;
        const leftLines = wrapCanvasText(page.ctx, leftSkill, colW - 20);
        const rightLines = rightSkill ? wrapCanvasText(page.ctx, rightSkill, colW - 20) : [];
        const rowLines = Math.max(leftLines.length, rightLines.length);
        ensureSpace(rowLines * 27 + 4);

        page.ctx.fillStyle = brandNavy;
        page.ctx.beginPath();
        page.ctx.arc(marginX + 5, page.y - 6, 3.2, 0, Math.PI * 2);
        page.ctx.fill();

        page.ctx.font = `500 18px ${fontFamily}`;
        page.ctx.fillStyle = inkBody;
        leftLines.forEach((l, idx) => {
          page.ctx.fillText(l, marginX + 18, page.y + idx * 27);
        });

        if (rightSkill) {
          page.ctx.fillStyle = brandNavy;
          page.ctx.beginPath();
          page.ctx.arc(marginX + colW + colGap + 5, page.y - 6, 3.2, 0, Math.PI * 2);
          page.ctx.fill();

          page.ctx.fillStyle = inkBody;
          rightLines.forEach((l, idx) => {
            page.ctx.fillText(l, marginX + colW + colGap + 18, page.y + idx * 27);
          });
        }
        page.y += rowLines * 27;
      }
      page.y += 4;
    }

    // Work Experience
    drawSectionHeading('WORK EXPERIENCE');
    const filledExps = data.experiences.filter(
      (x) =>
        x.jobTitle.trim() ||
        x.company.trim() ||
        x.duration.trim() ||
        x.responsibility.trim() ||
        x.achievements.trim()
    );

    if (data.isFresher || filledExps.length === 0) {
      drawTextLines(`For freshers: ${FRESHER_EXPERIENCE_TEXT}`, {
        font: `400 18px ${fontFamily}`,
        color: inkBody,
        lineHeight: 27,
      });
    } else {
      for (const exp of filledExps) {
        ensureSpace(64);
        const roleTitle = exp.jobTitle.trim() || 'Position';
        const duration = exp.duration.trim();

        page.ctx.font = `700 19px ${fontFamily}`;
        page.ctx.fillStyle = inkDark;
        page.ctx.fillText(roleTitle, marginX, page.y);

        if (duration) {
          page.ctx.font = `600 17px ${fontFamily}`;
          page.ctx.fillStyle = brandNavy;
          const durW = page.ctx.measureText(duration).width;
          page.ctx.fillText(duration, pageWidthPx - marginX - durW, page.y);
        }
        page.y += 26;

        if (exp.company.trim()) {
          drawTextLines(exp.company.trim(), {
            font: `600 17.5px ${fontFamily}`,
            color: inkMuted,
            lineHeight: 25,
          });
        }
        if (exp.responsibility.trim()) {
          drawTextLines(`•  ${exp.responsibility.trim()}`, {
            font: `400 18px ${fontFamily}`,
            color: inkBody,
            lineHeight: 26,
            x: marginX + 14,
            maxWidth: contentWidth - 14,
          });
        }
        if (exp.achievements.trim()) {
          drawTextLines(`•  ${exp.achievements.trim()}`, {
            font: `400 18px ${fontFamily}`,
            color: inkBody,
            lineHeight: 26,
            x: marginX + 14,
            maxWidth: contentWidth - 14,
          });
        }
        page.y += 6;
      }
    }

    // Projects & Achievements
    const projectLines = data.projects.map((p) => p.trim()).filter(Boolean);
    if (projectLines.length > 0 || data.certificates.trim()) {
      drawSectionHeading('PROJECTS & ACHIEVEMENTS');
      for (const proj of projectLines) {
        drawTextLines(`•  ${proj}`, {
          font: `400 18px ${fontFamily}`,
          color: inkBody,
          lineHeight: 26,
          x: marginX + 10,
          maxWidth: contentWidth - 10,
        });
      }
      if (data.certificates.trim()) {
        drawTextLines(`•  Certificates / Awards: ${data.certificates.trim()}`, {
          font: `400 18px ${fontFamily}`,
          color: inkBody,
          lineHeight: 26,
          x: marginX + 10,
          maxWidth: contentWidth - 10,
        });
      }
    }

    // Languages & Interests (Side-by-Side 2 Columns)
    const hasInterests = data.interests.length > 0;
    if (hasInterests) {
      ensureSpace(140);
      const colGap = 44;
      const colW = Math.floor((contentWidth - colGap) / 2);
      const rightX = marginX + colW + colGap;

      let leftY = drawSectionHeadingAt('LANGUAGES', page.y, marginX, colW);
      leftY = drawTextLinesAt('•  Bengali: Native', leftY, {
        font: `400 18px ${fontFamily}`,
        color: inkBody,
        lineHeight: 26,
        x: marginX + 8,
        maxWidth: colW - 8,
      });
      leftY = drawTextLinesAt(`•  English: ${data.englishLevel}`, leftY, {
        font: `400 18px ${fontFamily}`,
        color: inkBody,
        lineHeight: 26,
        x: marginX + 8,
        maxWidth: colW - 8,
      });
      if (data.otherLanguage.trim()) {
        leftY = drawTextLinesAt(`•  Other: ${data.otherLanguage.trim()}`, leftY, {
          font: `400 18px ${fontFamily}`,
          color: inkBody,
          lineHeight: 26,
          x: marginX + 8,
          maxWidth: colW - 8,
        });
      }

      let rightY = drawSectionHeadingAt('INTERESTS', page.y, rightX, colW);
      for (const interest of data.interests) {
        rightY = drawTextLinesAt(`•  ${interest}`, rightY, {
          font: `400 18px ${fontFamily}`,
          color: inkBody,
          lineHeight: 26,
          x: rightX + 8,
          maxWidth: colW - 8,
        });
      }

      page.y = Math.max(leftY, rightY) + 4;
    } else {
      drawSectionHeading('LANGUAGES');
      drawTextLines(
        [
          '•  Bengali: Native',
          `•  English: ${data.englishLevel}`,
          data.otherLanguage.trim() ? `•  Other: ${data.otherLanguage.trim()}` : '',
        ]
          .filter(Boolean)
          .join('     |     '),
        {
          font: `400 18px ${fontFamily}`,
          color: inkBody,
          lineHeight: 26,
          x: marginX + 8,
          maxWidth: contentWidth - 8,
        }
      );
    }

    // References
    drawSectionHeading('REFERENCES');
    drawTextLines('Available upon request.', {
      font: `400 18px ${fontFamily}`,
      color: inkBody,
      lineHeight: 26,
    });

    // Declaration
    drawSectionHeading('DECLARATION');
    drawTextLines(DEFAULT_DECLARATION, {
      font: `400 18px ${fontFamily}`,
      color: inkBody,
      lineHeight: 26,
    });

    ensureSpace(80);
    page.y += 34;
    page.ctx.font = `600 18px ${fontFamily}`;
    page.ctx.fillStyle = inkDark;
    const sigLabel = `Signature: ${data.signatureText.trim() || '____________________'}`;
    const dateLabel = `Date: ${data.declarationDate.trim() || '____________________'}`;
    page.ctx.fillText(sigLabel, marginX, page.y);
    const dateW = page.ctx.measureText(dateLabel).width;
    page.ctx.fillText(dateLabel, pageWidthPx - marginX - dateW, page.y);
    page.y += 18;

    return { canvases, finalY: page.y };
  };

  // First pass: measure and render cleanly without page slicing
  const singlePass = runDrawPass(false);
  const maxOnePageBottom = pageHeightPx - marginBottom;
  const maxGentleScaleBottom = 1920; // Up to ~12% over fits on 1 page without feeling squeezed

  let outputPages: HTMLCanvasElement[];

  if (singlePass.finalY <= maxGentleScaleBottom) {
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = pageWidthPx;
    finalCanvas.height = pageHeightPx;
    const fCtx = finalCanvas.getContext('2d')!;
    fCtx.fillStyle = '#FFFFFF';
    fCtx.fillRect(0, 0, pageWidthPx, pageHeightPx);
    fCtx.imageSmoothingEnabled = true;
    fCtx.imageSmoothingQuality = 'high';

    if (singlePass.finalY <= maxOnePageBottom) {
      fCtx.drawImage(
        singlePass.canvases[0],
        0,
        0,
        pageWidthPx,
        pageHeightPx,
        0,
        0,
        pageWidthPx,
        pageHeightPx
      );
    } else {
      const contentH = singlePass.finalY - marginTop;
      const availableH = pageHeightPx - marginTop - marginBottom;
      const scale = availableH / contentH;
      const scaledW = pageWidthPx * scale;
      const offsetX = (pageWidthPx - scaledW) / 2;

      fCtx.fillStyle = brandNavy;
      fCtx.fillRect(0, 0, pageWidthPx, 10);

      fCtx.drawImage(
        singlePass.canvases[0],
        0,
        marginTop,
        pageWidthPx,
        contentH,
        offsetX,
        marginTop,
        scaledW,
        availableH
      );
    }
    outputPages = [finalCanvas];
  } else {
    // Genuinely long CV: preserve comfortable readability across 2+ clean pages
    const multiPass = runDrawPass(true);
    outputPages = multiPass.canvases;
    if (outputPages.length > 1) {
      const total = outputPages.length;
      outputPages.forEach((canvas, idx) => {
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#94A3B8';
        ctx.font = `500 16px ${fontFamily}`;
        const footer = `${idx + 1} / ${total}`;
        const w = ctx.measureText(footer).width;
        ctx.fillText(footer, pageWidthPx - marginX - w, pageHeightPx - 28);
      });
    }
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  });

  outputPages.forEach((canvas, idx) => {
    if (idx > 0) pdf.addPage();
    const imgData = canvas.toDataURL('image/jpeg', 0.94);
    pdf.addImage(imgData, 'JPEG', 0, 0, 595.28, 841.89);
  });

  const buffer = pdf.output('arraybuffer');
  return new Uint8Array(buffer);
}

export async function generateAndDownloadCvPdf(
  data: CvData
): Promise<{ fileName: string; mode: 'shared' | 'downloaded'; savedToDocuments: boolean }> {
  const baseName = sanitizeFileName(data.fullName, 'Curriculum_Vitae');
  const fileName = `${baseName}_CV.pdf`;
  const pdfBytes = await renderCvToPdfBytes(data);

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
      // Cache + Share works across Android versions
    }

    const cached = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true,
    });

    await Share.share({
      title: `${data.fullName.trim() || 'Curriculum Vitae'} CV`,
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
