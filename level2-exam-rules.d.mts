export function determineExamStatus(total: number, writing: number, speaking: number): 'passed' | 'production_retake' | 'failed';
export function listeningPlayMayCount(startedAt: string | null, now?: number): boolean;
export function countExamWords(value: string): number;
