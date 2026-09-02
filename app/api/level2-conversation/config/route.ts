import { getSafeConversationRoomConfig } from '../../../../data/level2/conversation-room-safe';

export const dynamic = 'force-dynamic';

export async function GET() {
  const safeConfig = getSafeConversationRoomConfig();

  return Response.json(safeConfig, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}
