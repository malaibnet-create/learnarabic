import type { Metadata } from 'next';
import './globals.css';
import './features.css';
import './auth.css';
import './dashboard/dashboard.css';
import './morocco.css';
import './opi.css';
import './placement.css';
import './darija.css';
import './tutor.css';
import './booking.css';
import './lessons/[lessonId]/vocabulary/vocabulary.css';
import './levels/level.css';
import './lessons/[lessonId]/vocabulary/word-line.css';
import './reading.css';
import './reading-audio.css';
import './listening.css';
import './grammar.css';
import './speaking.css';
import './writing.css';
import './exam.css';
import './lesson2-responsive.css';
import './level3-vocabulary.css';
import './level3-phrases.css';
import './level3-reading.css';
import './level3-listening.css';
import './level3-grammar.css';
import './level3-conversation.css';
import './level3-final-exam.css';
import './level2-vocabulary.css';
import './level2-reading.css';
import './level2-listening.css';
import './level2-grammar.css';
import './level2-conversation.css';
import './learning-system.css';
import './learning-fixes.css';

export const metadata: Metadata = {
  title: 'ArabicPath — تعلّم العربية بوضوح',
  description: 'منصة عربية للتعلم الذاتي والتدرب مع المدرس الذكي',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
