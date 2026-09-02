export function determineExamStatus(total, writing, speaking) {
  if (total >= 80 && writing >= 5 && speaking >= 5) return 'passed';
  if (total >= 80 && (writing < 5 || speaking < 5)) return 'production_retake';
  return 'failed';
}

export function listeningPlayMayCount(startedAt, now = Date.now()) {
  if (!startedAt) return false;
  const elapsed = now - new Date(startedAt).getTime();
  return elapsed >= 19_200;
}

export function countExamWords(value) {
  return value.trim() ? value.trim().split(/\s+/u).length : 0;
}
