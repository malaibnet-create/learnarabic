export function determineExamStatus(total, writing, speaking) {
  if (total >= 70 && writing >= 8 && speaking >= 8) return 'passed';
  if (total >= 70 && (writing < 8 || speaking < 8)) return 'production_retake';
  return 'failed';
}

export function listeningPlayMayCount(startedAt, now = Date.now()) {
  if (!startedAt) return false;
  const elapsed = now - new Date(startedAt).getTime();
  return elapsed >= 91_660 * 0.8;
}

export function countExamWords(value) {
  return value.trim() ? value.trim().split(/\s+/u).length : 0;
}
