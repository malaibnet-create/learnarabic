export type LearningLevel = 'A1' | 'A2' | 'B1';
export type LearningSection = 'vocabulary' | 'reading' | 'listening' | 'grammar' | 'conversation' | 'phrases';
export type SectionState = 'not-started' | 'in-progress' | 'completed';

export type ReviewItem = {
  id: string;
  level: LearningLevel;
  lesson: number;
  section: LearningSection;
  arabic: string;
  english?: string;
  example?: string;
  audioUrl?: string;
  addedAt: string;
};

const SECTION_INDEX: Record<LearningSection, number> = {
  vocabulary: 0,
  reading: 1,
  listening: 2,
  grammar: 3,
  conversation: 4,
  phrases: 6,
};

const REQUIRED: Record<LearningLevel, LearningSection[]> = {
  A1: ['vocabulary', 'reading', 'listening', 'grammar', 'conversation'],
  A2: ['vocabulary', 'reading', 'listening', 'grammar', 'conversation'],
  B1: ['vocabulary', 'reading', 'listening', 'grammar', 'conversation', 'phrases'],
};

const progressKey = (level: LearningLevel, lesson: number) => `darlugha-${level.toLowerCase()}-lesson-${lesson}-section-status`;
const legacyKey = (level: LearningLevel, lesson: number) => `darlugha-${level.toLowerCase()}-lesson-${lesson}-sections`;
const lastLocationKey = 'darlugha-last-learning-location';
const reviewKey = 'darlugha-review-items';
const stateRank: Record<SectionState, number> = { 'not-started': 0, 'in-progress': 1, completed: 2 };

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function readLegacy(level: LearningLevel, lesson: number) {
  if (!canUseStorage()) return Array.from({ length: 7 }, () => false);
  try {
    const value = JSON.parse(localStorage.getItem(legacyKey(level, lesson)) || '[]');
    return Array.from({ length: 7 }, (_, index) => Boolean(Array.isArray(value) && value[index]));
  } catch {
    return Array.from({ length: 7 }, () => false);
  }
}

export function getSectionStates(level: LearningLevel, lesson: number): Record<LearningSection, SectionState> {
  const legacy = readLegacy(level, lesson);
  let saved: Partial<Record<LearningSection, SectionState>> = {};
  if (canUseStorage()) {
    try { saved = JSON.parse(localStorage.getItem(progressKey(level, lesson)) || '{}'); } catch { /* use legacy */ }
  }
  return Object.fromEntries(Object.entries(SECTION_INDEX).map(([section, index]) => [
    section,
    legacy[index] ? 'completed' : saved[section as LearningSection] || 'not-started',
  ])) as Record<LearningSection, SectionState>;
}

function saveStates(level: LearningLevel, lesson: number, states: Record<LearningSection, SectionState>) {
  if (!canUseStorage()) return;
  localStorage.setItem(progressKey(level, lesson), JSON.stringify(states));
  const legacy = readLegacy(level, lesson);
  for (const [section, index] of Object.entries(SECTION_INDEX)) legacy[index] = states[section as LearningSection] === 'completed';
  localStorage.setItem(legacyKey(level, lesson), JSON.stringify(legacy));
  window.dispatchEvent(new CustomEvent('darlugha-progress-changed', { detail: { level, lesson } }));
}

async function cloudClientWithUser() {
  if (!canUseStorage()) return null;
  try {
    const { createClient } = await import('./supabase/client');
    const client = createClient();
    const { data: { user } } = await client.auth.getUser();
    return user ? { client, user } : null;
  } catch {
    return null;
  }
}

async function syncSectionToCloud(level: LearningLevel, lesson: number, section: LearningSection, status: SectionState, href = '') {
  const cloud = await cloudClientWithUser();
  if (!cloud) return;
  await cloud.client.from('learning_section_progress').upsert({
    user_id: cloud.user.id,
    level_code: level,
    lesson_number: lesson,
    section,
    status,
    last_href: href || window.location.pathname + window.location.search,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,level_code,lesson_number,section' });
}

async function syncReviewToCloud(item: ReviewItem) {
  const cloud = await cloudClientWithUser();
  if (!cloud) return;
  await cloud.client.from('learning_review_items').upsert({
    user_id: cloud.user.id,
    item_key: item.id,
    level_code: item.level,
    lesson_number: item.lesson,
    section: item.section,
    arabic: item.arabic,
    english: item.english || null,
    example: item.example || null,
    audio_url: item.audioUrl || null,
    added_at: item.addedAt,
  }, { onConflict: 'user_id,item_key' });
}

async function removeReviewFromCloud(id: string) {
  const cloud = await cloudClientWithUser();
  if (!cloud) return;
  await cloud.client.from('learning_review_items').delete().eq('user_id', cloud.user.id).eq('item_key', id);
}

export function markSectionStarted(level: LearningLevel, lesson: number, section: LearningSection, href?: string) {
  if (!canUseStorage()) return;
  const states = getSectionStates(level, lesson);
  if (states[section] === 'not-started') states[section] = 'in-progress';
  saveStates(level, lesson, states);
  rememberLearningLocation(level, lesson, section, href);
  void syncSectionToCloud(level, lesson, section, states[section], href);
}

export function markSectionComplete(level: LearningLevel, lesson: number, section: LearningSection, href?: string) {
  if (!canUseStorage()) return;
  const states = getSectionStates(level, lesson);
  states[section] = 'completed';
  saveStates(level, lesson, states);
  rememberLearningLocation(level, lesson, section, href);
  void syncSectionToCloud(level, lesson, section, 'completed', href);
}

export function isLessonComplete(level: LearningLevel, lesson: number) {
  const states = getSectionStates(level, lesson);
  return REQUIRED[level].every((section) => states[section] === 'completed');
}

export function requiredSections(level: LearningLevel) {
  return [...REQUIRED[level]];
}

export function lessonHubHref(level: LearningLevel, lesson: number) {
  return `/levels/${level}?lesson=${lesson}`;
}

export function lessonExamHref(level: LearningLevel, lesson: number) {
  if (level === 'A2' && lesson === 1) return '/levels/A2/lessons/1/exam';
  if (level === 'B1' && lesson === 1) return '/levels/B1/lessons/1/exam';
  return `/lessons/${lesson}/exam`;
}

export function rememberLearningLocation(level: LearningLevel, lesson: number, section: LearningSection, href = '') {
  if (!canUseStorage()) return;
  localStorage.setItem(lastLocationKey, JSON.stringify({ level, lesson, section, href: href || window.location.pathname + window.location.search, updatedAt: new Date().toISOString() }));
}

export function getLastLearningLocation(): { level: LearningLevel; lesson: number; section: LearningSection; href: string; updatedAt: string } | null {
  if (!canUseStorage()) return null;
  try { return JSON.parse(localStorage.getItem(lastLocationKey) || 'null'); } catch { return null; }
}

export function getReviewItems(): ReviewItem[] {
  if (!canUseStorage()) return [];
  try {
    const value = JSON.parse(localStorage.getItem(reviewKey) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

export function upsertReviewItem(item: Omit<ReviewItem, 'addedAt'>) {
  if (!canUseStorage()) return;
  const items = getReviewItems();
  const next: ReviewItem = { ...item, addedAt: new Date().toISOString() };
  localStorage.setItem(reviewKey, JSON.stringify([next, ...items.filter((entry) => entry.id !== item.id)]));
  window.dispatchEvent(new Event('darlugha-review-changed'));
  void syncReviewToCloud(next);
}

export function removeReviewItem(id: string) {
  if (!canUseStorage()) return;
  localStorage.setItem(reviewKey, JSON.stringify(getReviewItems().filter((item) => item.id !== id)));
  window.dispatchEvent(new Event('darlugha-review-changed'));
  void removeReviewFromCloud(id);
}

export function isInReview(id: string) {
  return getReviewItems().some((item) => item.id === id);
}

/**
 * Merge cloud progress into local progress after sign-in. Local storage remains
 * the offline source of truth; completed states always win over older states.
 */
export async function hydrateLearningDataFromCloud() {
  const cloud = await cloudClientWithUser();
  if (!cloud) return false;
  const [{ data: sectionRows }, { data: reviewRows }] = await Promise.all([
    cloud.client.from('learning_section_progress').select('level_code,lesson_number,section,status,last_href,updated_at').eq('user_id', cloud.user.id),
    cloud.client.from('learning_review_items').select('item_key,level_code,lesson_number,section,arabic,english,example,audio_url,added_at').eq('user_id', cloud.user.id),
  ]);

  const touched = new Map<string, { level: LearningLevel; lesson: number }>([
    ['A1-1', { level: 'A1', lesson: 1 }],
    ['A1-2', { level: 'A1', lesson: 2 }],
    ['A2-1', { level: 'A2', lesson: 1 }],
    ['B1-1', { level: 'B1', lesson: 1 }],
  ]);
  for (const row of sectionRows || []) {
    const level = row.level_code as LearningLevel;
    const lesson = Number(row.lesson_number);
    const section = row.section as LearningSection;
    if (!REQUIRED[level]?.includes(section) || !Number.isInteger(lesson)) continue;
    const states = getSectionStates(level, lesson);
    const remote = row.status as SectionState;
    if (stateRank[remote] > stateRank[states[section]]) states[section] = remote;
    saveStates(level, lesson, states);
    touched.set(`${level}-${lesson}`, { level, lesson });
  }

  const localReview = getReviewItems();
  const merged = new Map(localReview.map((item) => [item.id, item]));
  for (const row of reviewRows || []) {
    const remote: ReviewItem = {
      id: row.item_key,
      level: row.level_code as LearningLevel,
      lesson: Number(row.lesson_number),
      section: row.section as LearningSection,
      arabic: row.arabic,
      english: row.english || undefined,
      example: row.example || undefined,
      audioUrl: row.audio_url || undefined,
      addedAt: row.added_at,
    };
    const current = merged.get(remote.id);
    if (!current || new Date(remote.addedAt).getTime() > new Date(current.addedAt).getTime()) merged.set(remote.id, remote);
  }
  const review = [...merged.values()].sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  localStorage.setItem(reviewKey, JSON.stringify(review));

  // Upload offline-only data after the merge.
  for (const { level, lesson } of touched.values()) {
    const states = getSectionStates(level, lesson);
    for (const section of REQUIRED[level]) if (states[section] !== 'not-started') void syncSectionToCloud(level, lesson, section, states[section]);
  }
  for (const item of review) void syncReviewToCloud(item);

  const newest = [...(sectionRows || [])].filter((row) => row.last_href).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
  if (newest) rememberLearningLocation(newest.level_code as LearningLevel, Number(newest.lesson_number), newest.section as LearningSection, newest.last_href);
  window.dispatchEvent(new Event('darlugha-review-changed'));
  window.dispatchEvent(new CustomEvent('darlugha-progress-changed', { detail: { cloud: true } }));
  return true;
}
