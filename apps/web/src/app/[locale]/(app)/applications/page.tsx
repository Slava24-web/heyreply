import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { ApplicationsPage } from '@/components/applications/applications-page';

export async function generateMetadata() {
  const t = await getTranslations('list');
  return { title: t('title') };
}

export default function Page() {
  return (
    <Suspense>
      <ApplicationsPage />
    </Suspense>
  );
}
