export type ConversationRealtimeStatus = 'learner-speaking' | 'understanding' | 'facilitator-speaking' | 'learner-turn' | 'error';
export type ConversationTranscriptEntry = { role: 'learner' | 'facilitator'; text: string };
export function readRealtimeEvent(event: Record<string, any>): {
  status?: ConversationRealtimeStatus;
  transcript?: ConversationTranscriptEntry;
  error?: string;
};
export function formatConversationTime(totalSeconds: number): string;
