import { Tajawal } from 'next/font/google';
import './globals.css';

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700', '800'],
  variable: '--font-tajawal',
  display: 'swap',
});

export const metadata = {
  title: 'Donatiq - تبرعات صنّاع المحتوى في العراق',
  description: 'اجمع التبرعات من متابعيك أثناء البث المباشر مع تنبيهات فورية على الشاشة.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
