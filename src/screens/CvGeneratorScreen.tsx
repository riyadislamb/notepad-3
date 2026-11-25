import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  Check,
  ChevronLeft,
  Download,
  Eye,
  FileText,
  Globe,
  Loader2,
  Mail,
  MapPin,
  PenLine,
  Phone,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { NavigationShell } from '../components/NavigationShell';
import { useNotes } from '../context/NotesContext';
import { CV_GENERATION_FOLDER_ID } from '../data/initialData';
import {
  CV_ENGLISH_LEVELS,
  CV_INTEREST_OPTIONS,
  CV_SKILL_OPTIONS,
  DEFAULT_CAREER_OBJECTIVE,
  DEFAULT_DECLARATION,
  FRESHER_EXPERIENCE_TEXT,
  buildCvNoteHtml,
  createDefaultCvData,
  generateAndDownloadCvPdf,
  loadCvDraft,
  saveCvDraft,
} from '../services/cvGeneratorService';
import { CvData, CvEducationEntry, CvExperienceEntry } from '../types/notes';

function makeRowId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function getTodayFormatted(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function CvGeneratorScreen() {
  const { goBack, showToast, activeNotes, canCreateNote, createNote, updateNote } = useNotes();

  const [cv, setCv] = useState<CvData>(() => loadCvDraft());
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [isGenerating, setIsGenerating] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  useEffect(() => {
    saveCvDraft(cv);
  }, [cv]);

  const updateField = <K extends keyof CvData>(key: K, value: CvData[K]) => {
    setCv((prev) => ({ ...prev, [key]: value }));
  };

  const updateEducation = (
    id: string,
    field: keyof Omit<CvEducationEntry, 'id'>,
    value: string
  ) => {
    setCv((prev) => ({
      ...prev,
      educations: prev.educations.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      ),
    }));
  };

  const addEducationRow = () => {
    setCv((prev) => ({
      ...prev,
      educations: [
        ...prev.educations,
        {
          id: makeRowId('edu'),
          qualification: '',
          institution: '',
          board: '',
          year: '',
          result: '',
        },
      ],
    }));
  };

  const removeEducationRow = (id: string) => {
    setCv((prev) => {
      if (prev.educations.length <= 1) return prev;
      return {
        ...prev,
        educations: prev.educations.filter((row) => row.id !== id),
      };
    });
  };

  const toggleSkill = (skill: string) => {
    setCv((prev) => {
      const exists = prev.skills.includes(skill);
      return {
        ...prev,
        skills: exists ? prev.skills.filter((s) => s !== skill) : [...prev.skills, skill],
      };
    });
  };

  const toggleAllSkills = () => {
    setCv((prev) => ({
      ...prev,
      skills:
        prev.skills.length === CV_SKILL_OPTIONS.length ? [] : [...CV_SKILL_OPTIONS],
    }));
  };

  const updateExperience = (
    id: string,
    field: keyof Omit<CvExperienceEntry, 'id'>,
    value: string
  ) => {
    setCv((prev) => ({
      ...prev,
      experiences: prev.experiences.map((exp) =>
        exp.id === id ? { ...exp, [field]: value } : exp
      ),
    }));
  };

  const addExperience = () => {
    setCv((prev) => ({
      ...prev,
      isFresher: false,
      experiences: [
        ...prev.experiences,
        {
          id: makeRowId('exp'),
          jobTitle: '',
          company: '',
          duration: '',
          responsibility: '',
          achievements: '',
        },
      ],
    }));
  };

  const removeExperience = (id: string) => {
    setCv((prev) => {
      if (prev.experiences.length <= 1) return prev;
      return {
        ...prev,
        experiences: prev.experiences.filter((exp) => exp.id !== id),
      };
    });
  };

  const updateProject = (idx: number, value: string) => {
    setCv((prev) => ({
      ...prev,
      projects: prev.projects.map((p, i) => (i === idx ? value : p)),
    }));
  };

  const addProject = () => {
    setCv((prev) => ({
      ...prev,
      projects: [...prev.projects, ''],
    }));
  };

  const removeProject = (idx: number) => {
    setCv((prev) => {
      if (prev.projects.length <= 1) return prev;
      return {
        ...prev,
        projects: prev.projects.filter((_, i) => i !== idx),
      };
    });
  };

  const toggleInterest = (interest: string) => {
    setCv((prev) => {
      const exists = prev.interests.includes(interest);
      return {
        ...prev,
        interests: exists
          ? prev.interests.filter((item) => item !== interest)
          : [...prev.interests, interest],
      };
    });
  };

  const handleGeneratePdf = async () => {
    if (isGenerating) return;
    if (!cv.fullName.trim()) {
      showToast('Please enter your full name first', 'danger');
      setViewMode('edit');
      return;
    }

    setIsGenerating(true);
    try {
      const noteTitle = `${cv.fullName.trim()} — CV`;
      const noteContent = buildCvNoteHtml(cv);
      const existingCvNote = activeNotes.find(
        (n) => n.folderId === CV_GENERATION_FOLDER_ID && n.title === noteTitle
      );

      if (existingCvNote) {
        updateNote(existingCvNote.id, { title: noteTitle, content: noteContent });
      } else if (canCreateNote) {
        createNote({
          title: noteTitle,
          content: noteContent,
          folderId: CV_GENERATION_FOLDER_ID,
        });
      }

      const result = await generateAndDownloadCvPdf(cv);
      if (result.mode === 'shared') {
        showToast(
          result.savedToDocuments
            ? `Saved & ready: Documents/Notes/${result.fileName}`
            : `PDF ready: ${result.fileName}`
        );
      } else {
        showToast(`Downloaded ${result.fileName}`);
      }
    } catch {
      showToast('Could not generate CV PDF. Please try again.', 'danger');
    } finally {
      setIsGenerating(false);
    }
  };

  const inputClass =
    'w-full min-h-[42px] rounded-xl border border-[var(--divider)] bg-[var(--bg-canvas)] px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/75 focus:outline-none focus:border-[var(--accent-primary)] transition-colors';

  const selectClass =
    'w-full min-h-[42px] rounded-xl border border-[var(--divider)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors';

  const cardClass =
    'rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-4 sm:p-5 space-y-3';

  const filledEducations = cv.educations.filter(
    (e) =>
      e.qualification.trim() ||
      e.institution.trim() ||
      e.board.trim() ||
      e.year.trim() ||
      e.result.trim()
  );

  const filledExperiences = cv.experiences.filter(
    (x) =>
      x.jobTitle.trim() ||
      x.company.trim() ||
      x.duration.trim() ||
      x.responsibility.trim() ||
      x.achievements.trim()
  );

  const filledProjects = cv.projects.map((p) => p.trim()).filter(Boolean);

  return (
    <NavigationShell showMobileTabs={false} noPaddingBottom>
      <header className="sticky top-0 z-20 bg-[var(--bg-canvas)]/95 backdrop-blur-md border-b border-[var(--divider)] px-4 sm:px-8 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={goBack}
              aria-label="Back"
              className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer shrink-0"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2} />
            </button>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-primary)] truncate">
              CV Generator
            </h1>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="inline-flex rounded-xl bg-[var(--bg-card)] border border-[var(--divider)] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === 'edit'
                    ? 'bg-[var(--accent-primary)] text-[#171717]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <PenLine className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === 'preview'
                    ? 'bg-[var(--accent-primary)] text-[#171717]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </button>
            </div>

            <button
              type="button"
              onClick={() => setResetConfirmOpen(true)}
              aria-label="Reset CV form"
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" strokeWidth={1.9} />
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 sm:px-8 pt-4 pb-28">
        {viewMode === 'edit' ? (
          <div className="space-y-4">
            {/* Basic Header Information */}
            <section className={cardClass}>
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  CURRICULUM VITAE — HEADER
                </h2>
                <FileText className="h-4 w-4 text-[var(--accent-primary)]" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={cv.fullName}
                  onChange={(e) => updateField('fullName', e.target.value)}
                  placeholder="YOUR FULL NAME"
                  aria-label="Your Full Name"
                  className={`${inputClass} sm:col-span-2 font-medium`}
                />
                <input
                  type="tel"
                  value={cv.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="📞 Phone: Your Phone Number"
                  aria-label="Phone Number"
                  className={inputClass}
                />
                <input
                  type="email"
                  value={cv.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="✉️ Email: Your Email Address"
                  aria-label="Email Address"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={cv.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="📍 Address: Your Full Address"
                  aria-label="Full Address"
                  className={inputClass}
                />
                <input
                  type="url"
                  value={cv.portfolioLink}
                  onChange={(e) => updateField('portfolioLink', e.target.value)}
                  placeholder="🌐 Portfolio / LinkedIn (Optional Link)"
                  aria-label="Portfolio or LinkedIn Link"
                  className={inputClass}
                />
              </div>
            </section>

            {/* Career Objective */}
            <section className={cardClass}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  CAREER OBJECTIVE
                </h2>
                <button
                  type="button"
                  onClick={() => updateField('careerObjective', DEFAULT_CAREER_OBJECTIVE)}
                  className="text-xs font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer"
                >
                  Use Default
                </button>
              </div>
              <textarea
                rows={4}
                value={cv.careerObjective}
                onChange={(e) => updateField('careerObjective', e.target.value)}
                placeholder="Write your career objective..."
                aria-label="Career Objective"
                className={`${inputClass} resize-y min-h-[96px] leading-relaxed`}
              />
            </section>

            {/* Personal Information */}
            <section className={cardClass}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                PERSONAL INFORMATION
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={cv.fathersName}
                  onChange={(e) => updateField('fathersName', e.target.value)}
                  placeholder="Father's Name"
                  aria-label="Father's Name"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={cv.mothersName}
                  onChange={(e) => updateField('mothersName', e.target.value)}
                  placeholder="Mother's Name"
                  aria-label="Mother's Name"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={cv.dateOfBirth}
                  onChange={(e) => updateField('dateOfBirth', e.target.value)}
                  placeholder="Date of Birth (DD/MM/YYYY)"
                  aria-label="Date of Birth"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={cv.nationality}
                  onChange={(e) => updateField('nationality', e.target.value)}
                  placeholder="Nationality (e.g. Bangladeshi)"
                  aria-label="Nationality"
                  className={inputClass}
                />
                <select
                  value={cv.gender}
                  onChange={(e) => updateField('gender', e.target.value)}
                  aria-label="Gender"
                  className={selectClass}
                >
                  <option value="">Gender (Optional)</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                <select
                  value={cv.maritalStatus}
                  onChange={(e) => updateField('maritalStatus', e.target.value)}
                  aria-label="Marital Status"
                  className={selectClass}
                >
                  <option value="">Marital Status (Optional)</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </section>

            {/* Educational Qualifications */}
            <section className={cardClass}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  EDUCATIONAL QUALIFICATIONS
                </h2>
                <button
                  type="button"
                  onClick={addEducationRow}
                  className="inline-flex items-center gap-1 rounded-xl bg-[var(--accent-soft)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:opacity-90 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                  Add Row
                </button>
              </div>

              <div className="space-y-3">
                {cv.educations.map((row, index) => (
                  <div
                    key={row.id}
                    className="rounded-xl border border-[var(--divider)] bg-[var(--bg-canvas)]/60 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">
                        #{index + 1}
                      </span>
                      {cv.educations.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEducationRow(row.id)}
                          aria-label={`Remove qualification ${index + 1}`}
                          className="p-1 text-[#E45B5B] hover:bg-[var(--bg-subtle)] rounded-lg cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={row.qualification}
                        onChange={(e) => updateEducation(row.id, 'qualification', e.target.value)}
                        placeholder="Qualification [Degree/Class]"
                        aria-label="Qualification"
                        className={inputClass}
                      />
                      <input
                        type="text"
                        value={row.institution}
                        onChange={(e) => updateEducation(row.id, 'institution', e.target.value)}
                        placeholder="Institution [Name]"
                        aria-label="Institution"
                        className={inputClass}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={row.board}
                        onChange={(e) => updateEducation(row.id, 'board', e.target.value)}
                        placeholder="Board"
                        aria-label="Board"
                        className={inputClass}
                      />
                      <input
                        type="text"
                        value={row.year}
                        onChange={(e) => updateEducation(row.id, 'year', e.target.value)}
                        placeholder="Year"
                        aria-label="Year"
                        className={inputClass}
                      />
                      <input
                        type="text"
                        value={row.result}
                        onChange={(e) => updateEducation(row.id, 'result', e.target.value)}
                        placeholder="Result"
                        aria-label="Result"
                        className={inputClass}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Skills (Select-only) */}
            <section className={cardClass}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  SKILLS ({cv.skills.length}/{CV_SKILL_OPTIONS.length})
                </h2>
                <button
                  type="button"
                  onClick={toggleAllSkills}
                  className="text-xs font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer"
                >
                  {cv.skills.length === CV_SKILL_OPTIONS.length ? 'Clear All' : 'Select All'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CV_SKILL_OPTIONS.map((skill) => {
                  const selected = cv.skills.includes(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      aria-pressed={selected}
                      className={`flex min-h-[44px] items-center justify-between gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium transition-colors cursor-pointer ${
                        selected
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--text-primary)]'
                          : 'border-[var(--divider)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <span className="leading-snug">{skill}</span>
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                          selected
                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[#171717]'
                            : 'border-[var(--divider)]'
                        }`}
                      >
                        {selected && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Work Experience */}
            <section className={cardClass}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  WORK EXPERIENCE
                </h2>

                <div className="inline-flex rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] p-0.5">
                  <button
                    type="button"
                    onClick={() => updateField('isFresher', false)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                      !cv.isFresher
                        ? 'bg-[var(--accent-primary)] text-[#171717]'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    Experienced
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('isFresher', true)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                      cv.isFresher
                        ? 'bg-[var(--accent-primary)] text-[#171717]'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    Fresher
                  </button>
                </div>
              </div>

              {cv.isFresher ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-[var(--accent-primary)]/40 bg-[var(--accent-soft)]/50 p-3.5 text-sm text-[var(--text-primary)]">
                  <Briefcase className="h-4 w-4 text-[var(--accent-primary)] shrink-0 mt-0.5" />
                  <span>{FRESHER_EXPERIENCE_TEXT}</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {cv.experiences.map((exp, index) => (
                    <div
                      key={exp.id}
                      className="rounded-xl border border-[var(--divider)] bg-[var(--bg-canvas)]/60 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[var(--text-secondary)]">
                          Experience #{index + 1}
                        </span>
                        {cv.experiences.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeExperience(exp.id)}
                            aria-label={`Remove experience ${index + 1}`}
                            className="p-1 text-[#E45B5B] hover:bg-[var(--bg-subtle)] rounded-lg cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={exp.jobTitle}
                          onChange={(e) => updateExperience(exp.id, 'jobTitle', e.target.value)}
                          placeholder="[Job Title / Position]"
                          aria-label="Job Title or Position"
                          className={inputClass}
                        />
                        <input
                          type="text"
                          value={exp.company}
                          onChange={(e) => updateExperience(exp.id, 'company', e.target.value)}
                          placeholder="Company / Institution: [Name]"
                          aria-label="Company or Institution"
                          className={inputClass}
                        />
                        <input
                          type="text"
                          value={exp.duration}
                          onChange={(e) => updateExperience(exp.id, 'duration', e.target.value)}
                          placeholder="Duration: [Starting Date – Ending Date]"
                          aria-label="Duration"
                          className={`${inputClass} sm:col-span-2`}
                        />
                        <input
                          type="text"
                          value={exp.responsibility}
                          onChange={(e) =>
                            updateExperience(exp.id, 'responsibility', e.target.value)
                          }
                          placeholder="[Your responsibility]"
                          aria-label="Your responsibility"
                          className={inputClass}
                        />
                        <input
                          type="text"
                          value={exp.achievements}
                          onChange={(e) =>
                            updateExperience(exp.id, 'achievements', e.target.value)
                          }
                          placeholder="[Your achievements]"
                          aria-label="Your achievements"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addExperience}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:opacity-90 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                    Add Experience
                  </button>
                </div>
              )}
            </section>

            {/* Projects & Achievements */}
            <section className={cardClass}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  PROJECTS & ACHIEVEMENTS
                </h2>
                <button
                  type="button"
                  onClick={addProject}
                  className="inline-flex items-center gap-1 rounded-xl bg-[var(--accent-soft)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:opacity-90 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                  Add
                </button>
              </div>

              <div className="space-y-2">
                {cv.projects.map((proj, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={proj}
                      onChange={(e) => updateProject(idx, e.target.value)}
                      placeholder={`[Project or achievement ${idx + 1}]`}
                      aria-label={`Project or achievement ${idx + 1}`}
                      className={inputClass}
                    />
                    {cv.projects.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeProject(idx)}
                        aria-label={`Remove project ${idx + 1}`}
                        className="min-h-[42px] min-w-[40px] flex items-center justify-center rounded-xl text-[#E45B5B] hover:bg-[var(--bg-subtle)] cursor-pointer shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}

                <input
                  type="text"
                  value={cv.certificates}
                  onChange={(e) => updateField('certificates', e.target.value)}
                  placeholder="[Certificates or awards (Optional)]"
                  aria-label="Certificates or awards"
                  className={inputClass}
                />
              </div>
            </section>

            {/* Languages */}
            <section className={cardClass}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                LANGUAGES
              </h2>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--divider)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm">
                <span className="font-medium text-[var(--text-primary)]">Bengali</span>
                <span className="rounded-lg bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--text-primary)]">
                  Native
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--divider)] bg-[var(--bg-canvas)] px-3.5 py-2 text-sm">
                <span className="font-medium text-[var(--text-primary)]">English</span>
                <div className="inline-flex rounded-lg bg-[var(--bg-card)] border border-[var(--divider)] p-0.5">
                  {CV_ENGLISH_LEVELS.map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => updateField('englishLevel', lvl)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                        cv.englishLevel === lvl
                          ? 'bg-[var(--accent-primary)] text-[#171717]'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="text"
                value={cv.otherLanguage}
                onChange={(e) => updateField('otherLanguage', e.target.value)}
                placeholder="Other: [Language (Optional)]"
                aria-label="Other Language"
                className={inputClass}
              />
            </section>

            {/* Interests */}
            <section className={cardClass}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                INTERESTS
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CV_INTEREST_OPTIONS.map((item) => {
                  const selected = cv.interests.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleInterest(item)}
                      aria-pressed={selected}
                      className={`flex min-h-[42px] items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-left text-sm font-medium transition-colors cursor-pointer ${
                        selected
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--text-primary)]'
                          : 'border-[var(--divider)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <span>{item}</span>
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                          selected
                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[#171717]'
                            : 'border-[var(--divider)]'
                        }`}
                      >
                        {selected && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* References & Declaration */}
            <section className={cardClass}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  REFERENCES & DECLARATION
                </h2>
                <button
                  type="button"
                  onClick={() => updateField('declarationDate', getTodayFormatted())}
                  className="text-xs font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer"
                >
                  Today&apos;s Date
                </button>
              </div>

              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                References: Available upon request. — {DEFAULT_DECLARATION}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={cv.signatureText}
                  onChange={(e) => updateField('signatureText', e.target.value)}
                  placeholder="Signature (Optional)"
                  aria-label="Signature"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={cv.declarationDate}
                  onChange={(e) => updateField('declarationDate', e.target.value)}
                  placeholder="Date (Optional, DD/MM/YYYY)"
                  aria-label="Declaration Date"
                  className={inputClass}
                />
              </div>
            </section>
          </div>
        ) : (
          /* Live A4 Document Preview */
          <article className="mx-auto max-w-3xl overflow-hidden rounded-2xl bg-white text-[#1F2937] border border-[var(--divider)] shadow-sm">
            <div className="h-2 w-full bg-[#1E3A5F]" />

            <div className="bg-[#F8FAFC] border-b-2 border-[#1E3A5F] px-5 sm:px-9 pt-4 pb-6 text-center">
              <div className="flex justify-end mb-2">
                <span className="text-xs font-medium text-[#475569] tabular-nums">
                  Date: {getTodayFormatted()}
                </span>
              </div>
              <p className="text-base sm:text-lg font-bold tracking-[0.2em] text-[#1E3A5F] uppercase">
                CURRICULUM VITAE
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A] uppercase">
                {cv.fullName.trim() || '[YOUR FULL NAME]'}
              </h2>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-[#475569] pt-2">
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-[#1E3A5F]" />
                  {cv.phone.trim() || '[Your Phone Number]'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-[#1E3A5F]" />
                  {cv.email.trim() || '[Your Email Address]'}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs sm:text-sm text-[#475569]">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-[#1E3A5F]" />
                  <span>{cv.address.trim() || '[Your Full Address]'}</span>
                </span>
                {cv.portfolioLink.trim() && (
                  <span className="inline-flex items-center gap-1.5 text-[#1E3A5F] font-medium break-all">
                    <Globe className="h-3.5 w-3.5 shrink-0" />
                    <span>{cv.portfolioLink.trim()}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="p-5 sm:p-9 space-y-6">
              {/* Career Objective */}
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-xs sm:text-[13px] font-bold uppercase tracking-wider text-[#1E3A5F] border-b border-[#CBD5E1] pb-1.5">
                  <span className="inline-block h-3.5 w-1 bg-[#1E3A5F] rounded-xs" />
                  CAREER OBJECTIVE
                </h3>
                <p className="text-xs sm:text-sm text-[#1F2937] leading-relaxed">
                  {cv.careerObjective.trim() || DEFAULT_CAREER_OBJECTIVE}
                </p>
              </section>

              {/* Personal Information */}
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-xs sm:text-[13px] font-bold uppercase tracking-wider text-[#1E3A5F] border-b border-[#CBD5E1] pb-1.5">
                  <span className="inline-block h-3.5 w-1 bg-[#1E3A5F] rounded-xs" />
                  PERSONAL INFORMATION
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-8 text-xs sm:text-sm text-[#1F2937]">
                  <p>
                    <span className="font-semibold text-[#0F172A]">Father&apos;s Name:</span>{' '}
                    {cv.fathersName.trim() || "[Father's Name]"}
                  </p>
                  <p>
                    <span className="font-semibold text-[#0F172A]">Mother&apos;s Name:</span>{' '}
                    {cv.mothersName.trim() || "[Mother's Name]"}
                  </p>
                  <p>
                    <span className="font-semibold text-[#0F172A]">Date of Birth:</span>{' '}
                    {cv.dateOfBirth.trim() || '[DD/MM/YYYY]'}
                  </p>
                  <p>
                    <span className="font-semibold text-[#0F172A]">Nationality:</span>{' '}
                    {cv.nationality.trim() || '[Nationality]'}
                  </p>
                  {cv.gender.trim() && (
                    <p>
                      <span className="font-semibold text-[#0F172A]">Gender:</span> {cv.gender.trim()}
                    </p>
                  )}
                  {cv.maritalStatus.trim() && (
                    <p>
                      <span className="font-semibold text-[#0F172A]">Marital Status:</span>{' '}
                      {cv.maritalStatus.trim()}
                    </p>
                  )}
                </div>
              </section>

              {/* Educational Qualifications */}
              <section className="space-y-2.5">
                <h3 className="flex items-center gap-2 text-xs sm:text-[13px] font-bold uppercase tracking-wider text-[#1E3A5F] border-b border-[#CBD5E1] pb-1.5">
                  <span className="inline-block h-3.5 w-1 bg-[#1E3A5F] rounded-xs" />
                  EDUCATIONAL QUALIFICATIONS
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-[#1E3A5F] text-left text-white">
                        <th className="border border-[#1E3A5F] px-3 py-2 font-semibold">
                          Qualification
                        </th>
                        <th className="border border-[#1E3A5F] px-3 py-2 font-semibold">
                          Institution
                        </th>
                        <th className="border border-[#1E3A5F] px-3 py-2 font-semibold">
                          Board
                        </th>
                        <th className="border border-[#1E3A5F] px-3 py-2 font-semibold">
                          Year
                        </th>
                        <th className="border border-[#1E3A5F] px-3 py-2 font-semibold">
                          Result
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(filledEducations.length > 0 ? filledEducations : cv.educations).map(
                        (row, idx) => (
                          <tr
                            key={row.id}
                            className={idx % 2 === 1 ? 'bg-[#F8FAFC]' : 'bg-white'}
                          >
                            <td className="border border-[#E2E8F0] px-3 py-2">
                              {row.qualification.trim() || '[Degree/Class]'}
                            </td>
                            <td className="border border-[#E2E8F0] px-3 py-2">
                              {row.institution.trim() || '[Name]'}
                            </td>
                            <td className="border border-[#E2E8F0] px-3 py-2">
                              {row.board.trim() || '[Board]'}
                            </td>
                            <td className="border border-[#E2E8F0] px-3 py-2">
                              {row.year.trim() || '[Year]'}
                            </td>
                            <td className="border border-[#E2E8F0] px-3 py-2">
                              {row.result.trim() || '[Result]'}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Skills */}
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-xs sm:text-[13px] font-bold uppercase tracking-wider text-[#1E3A5F] border-b border-[#CBD5E1] pb-1.5">
                  <span className="inline-block h-3.5 w-1 bg-[#1E3A5F] rounded-xs" />
                  SKILLS
                </h3>
                {cv.skills.length > 0 ? (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-8 text-xs sm:text-sm text-[#1F2937]">
                    {cv.skills.map((skill) => (
                      <li key={skill} className="flex items-center gap-2.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#1E3A5F] shrink-0" />
                        <span>{skill}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs sm:text-sm text-[#64748B] italic">
                    No skills selected yet.
                  </p>
                )}
              </section>

              {/* Work Experience */}
              <section className="space-y-2.5">
                <h3 className="flex items-center gap-2 text-xs sm:text-[13px] font-bold uppercase tracking-wider text-[#1E3A5F] border-b border-[#CBD5E1] pb-1.5">
                  <span className="inline-block h-3.5 w-1 bg-[#1E3A5F] rounded-xs" />
                  WORK EXPERIENCE
                </h3>
                {cv.isFresher || filledExperiences.length === 0 ? (
                  <p className="text-xs sm:text-sm text-[#1F2937] leading-relaxed">
                    <span className="font-semibold text-[#0F172A]">For freshers:</span>{' '}
                    {FRESHER_EXPERIENCE_TEXT}
                  </p>
                ) : (
                  <div className="space-y-3.5">
                    {filledExperiences.map((exp) => (
                      <div key={exp.id} className="text-xs sm:text-sm text-[#1F2937] space-y-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="font-bold text-[#0F172A]">
                            {exp.jobTitle.trim() || '[Job Title / Position]'}
                          </p>
                          {exp.duration.trim() && (
                            <span className="text-xs font-semibold text-[#1E3A5F]">
                              {exp.duration.trim()}
                            </span>
                          )}
                        </div>
                        {exp.company.trim() && (
                          <p className="font-medium text-[#475569]">{exp.company.trim()}</p>
                        )}
                        {(exp.responsibility.trim() || exp.achievements.trim()) && (
                          <ul className="list-disc pl-5 pt-0.5 space-y-1">
                            {exp.responsibility.trim() && <li>{exp.responsibility.trim()}</li>}
                            {exp.achievements.trim() && <li>{exp.achievements.trim()}</li>}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Projects & Achievements */}
              {(filledProjects.length > 0 || cv.certificates.trim()) && (
                <section className="space-y-2">
                  <h3 className="flex items-center gap-2 text-xs sm:text-[13px] font-bold uppercase tracking-wider text-[#1E3A5F] border-b border-[#CBD5E1] pb-1.5">
                    <span className="inline-block h-3.5 w-1 bg-[#1E3A5F] rounded-xs" />
                    PROJECTS & ACHIEVEMENTS
                  </h3>
                  <ul className="list-disc pl-5 text-xs sm:text-sm text-[#1F2937] space-y-1">
                    {filledProjects.map((proj, idx) => (
                      <li key={idx}>{proj}</li>
                    ))}
                    {cv.certificates.trim() && (
                      <li>Certificates / Awards: {cv.certificates.trim()}</li>
                    )}
                  </ul>
                </section>
              )}

              {/* Languages & Interests */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <section className="space-y-2">
                  <h3 className="flex items-center gap-2 text-xs sm:text-[13px] font-bold uppercase tracking-wider text-[#1E3A5F] border-b border-[#CBD5E1] pb-1.5">
                    <span className="inline-block h-3.5 w-1 bg-[#1E3A5F] rounded-xs" />
                    LANGUAGES
                  </h3>
                  <ul className="list-disc pl-5 text-xs sm:text-sm text-[#1F2937] space-y-1">
                    <li>Bengali: Native</li>
                    <li>English: {cv.englishLevel}</li>
                    {cv.otherLanguage.trim() && <li>Other: {cv.otherLanguage.trim()}</li>}
                  </ul>
                </section>

                {cv.interests.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="flex items-center gap-2 text-xs sm:text-[13px] font-bold uppercase tracking-wider text-[#1E3A5F] border-b border-[#CBD5E1] pb-1.5">
                      <span className="inline-block h-3.5 w-1 bg-[#1E3A5F] rounded-xs" />
                      INTERESTS
                    </h3>
                    <ul className="list-disc pl-5 text-xs sm:text-sm text-[#1F2937] space-y-1">
                      {cv.interests.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>

              {/* References */}
              <section className="space-y-1.5">
                <h3 className="flex items-center gap-2 text-xs sm:text-[13px] font-bold uppercase tracking-wider text-[#1E3A5F] border-b border-[#CBD5E1] pb-1.5">
                  <span className="inline-block h-3.5 w-1 bg-[#1E3A5F] rounded-xs" />
                  REFERENCES
                </h3>
                <p className="text-xs sm:text-sm text-[#1F2937]">Available upon request.</p>
              </section>

              {/* Declaration */}
              <section className="space-y-4">
                <h3 className="flex items-center gap-2 text-xs sm:text-[13px] font-bold uppercase tracking-wider text-[#1E3A5F] border-b border-[#CBD5E1] pb-1.5">
                  <span className="inline-block h-3.5 w-1 bg-[#1E3A5F] rounded-xs" />
                  DECLARATION
                </h3>
                <p className="text-xs sm:text-sm text-[#1F2937] leading-relaxed">
                  {DEFAULT_DECLARATION}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 text-xs sm:text-sm font-semibold text-[#0F172A]">
                  <span>
                    Signature: {cv.signatureText.trim() || '__________________'}
                  </span>
                  <span>
                    Date: {cv.declarationDate.trim() || '__________________'}
                  </span>
                </div>
              </section>
            </div>
          </article>
        )}
      </div>

      {/* Bottom Sticky Generate Bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-30 border-t border-[var(--divider)] bg-[var(--bg-card)]/95 backdrop-blur-md px-4 sm:px-8 py-3">
        <div className="mx-auto flex max-w-4xl items-center gap-2.5">
          <button
            type="button"
            onClick={() => setViewMode((m) => (m === 'edit' ? 'preview' : 'edit'))}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border border-[var(--divider)] bg-[var(--bg-canvas)] px-4 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer shrink-0"
          >
            {viewMode === 'edit' ? (
              <>
                <Eye className="h-4 w-4 text-[var(--accent-primary)]" />
                <span>Preview CV</span>
              </>
            ) : (
              <>
                <PenLine className="h-4 w-4 text-[var(--accent-primary)]" />
                <span>Edit Info</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => void handleGeneratePdf()}
            disabled={isGenerating}
            className="flex-1 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] px-5 text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] hover:opacity-90 disabled:opacity-60 cursor-pointer"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" strokeWidth={2.2} />
            )}
            <span>{isGenerating ? 'Generating PDF...' : 'PDF CV Generate'}</span>
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={resetConfirmOpen}
        title="Reset CV form?"
        description="This will clear all entered CV fields so you can start fresh."
        confirmLabel="Reset"
        onConfirm={() => {
          setCv(createDefaultCvData());
          showToast('CV form reset');
        }}
        onClose={() => setResetConfirmOpen(false)}
      />
    </NavigationShell>
  );
}
