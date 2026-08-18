import type { Metadata } from 'next';
import './globals.css';
import './features.css';
import './auth.css';
import './dashboard/dashboard.css';
import './morocco.css';
import './opi.css';
import './placement.css';
import './darija.css';

export const metadata: Metadata = {
  title: 'ArabicPath — تعلّم العربية بوضوح',
  description: 'منصة عربية للتعلم الذاتي والتدرب مع المدرس الذكي',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
