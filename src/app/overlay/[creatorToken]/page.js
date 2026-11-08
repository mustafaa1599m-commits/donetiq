import OverlayClient from '@/components/OverlayClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Donatiq Alerts', robots: { index: false, follow: false } };

// صفحة شفافة تُضاف كمصدر Browser في OBS / مصدر رابط في TikTok LIVE Studio.
// ?demo=1 : يعرض تنبيهات تجريبية كل 9 ثوانٍ للمعاينة. ?debug=1 : يعرض حالة الاتصال.
export default function OverlayPage({ params, searchParams }) {
  return (
    <OverlayClient
      token={params.creatorToken}
      demo={searchParams && searchParams.demo === '1'}
      debug={searchParams && searchParams.debug === '1'}
    />
  );
}
