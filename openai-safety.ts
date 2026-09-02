import { createHmac } from 'node:crypto';

export function createOpenAISafetyIdentifier(userId: string) {
  const salt = process.env.OPENAI_SAFETY_SALT;
  if (!salt) throw new Error('OPENAI_SAFETY_SALT_MISSING');
  return createHmac('sha256', salt).update(userId).digest('hex');
}
