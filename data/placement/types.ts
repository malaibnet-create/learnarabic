export type PlacementSkill = 'listening' | 'reading' | 'writing' | 'speaking';
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2';

export type PlacementQuestion = {
  id: number;
  skill: PlacementSkill;
  cefrLevel: CefrLevel;
  type: 'choice' | 'reorder' | 'short-text' | 'writing' | 'speaking';
  prompt: string;
  passage?: string;
  options?: string[];
  audioPath?: string;
  minWords?: number;
  maxWords?: number;
  maxSeconds?: number;
};

export type PlacementResponse = {
  questionId: number;
  value?: number | string;
  recordingPath?: string;
};
