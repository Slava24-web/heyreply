import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { Dashboard } from '@/components/dashboard/dashboard';

export async function generateMetadata() {
  const t = await getTranslations('dashboard');
  return { title: t('title') };
}

export default function Page() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
