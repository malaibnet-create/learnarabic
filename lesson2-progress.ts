import { getSectionStates, markSectionComplete, markSectionStarted } from './learning-progress';

export type Lesson2Section = 'vocabulary' | 'reading' | 'listening' | 'grammar' | 'conversation';
export type Lesson2SectionState = 'not-started' | 'in-progress' | 'completed';

const LEGACY_KEY = 'darlugha-a1-lesson-2-sections';
const STATUS_KEY = 'darlugha-a1-lesson-2-section-status';
const sectionOrder: Lesson2Section[] = ['vocabulary', 'reading', 'listening', 'grammar', 'conversation'];

function readLegacy(): boolean[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]');
    return Array.isArray(parsed) ? sectionOrder.map((_, index) => Boolean(parsed[index])) : sectionOrder.map(() => false);
  } catch { return sectionOrder.map(() => false); }
}

function writeLegacy(values: boolean[]) {
  localStorage.setItem(LEGACY_KEY, JSON.stringify(sectionOrder.map((_, index) => Boolean(values[index]))));
}

export function getLesson2SectionStates(): Record<Lesson2Section, Lesson2SectionState> {
  const legacy = readLegacy();
  let saved: Partial<Record<Lesson2Section, Lesson2SectionState>> = {};
  try { saved = JSON.parse(localStorage.getItem(STATUS_KEY) || '{}'); } catch { /* use legacy */ }
  return Object.fromEntries(sectionOrder.map((section, index) => [section, legacy[index] ? 'completed' : saved[section] || 'not-started'])) as Record<Lesson2Section, Lesson2SectionState>;
}

export function markLesson2SectionStarted(section: Lesson2Section) {
  const states = getLesson2SectionStates();
  if (states[section] === 'not-started') states[section] = 'in-progress';
  localStorage.setItem(STATUS_KEY, JSON.stringify(states));
  markSectionStarted('A1', 2, section);
}

export function markLesson2SectionComplete(section: Lesson2Section) {
  const states = getLesson2SectionStates();
  states[section] = 'completed';
  localStorage.setItem(STATUS_KEY, JSON.stringify(states));
  const legacy = readLegacy();
  legacy[sectionOrder.indexOf(section)] = true;
  writeLegacy(legacy);
  markSectionComplete('A1', 2, section);
}

export function isLesson2Complete() {
  return sectionOrder.every((section) => getLesson2SectionStates()[section] === 'completed');
}

export const lesson2SectionOrder = sectionOrder;
