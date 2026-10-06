import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { DictionariesPage } from '@/components/settings/dictionaries-page';

export async function generateMetadata() {
  const t = await getTranslations('dict');
  return { title: t('title') };
}

export default function Page() {
  return (
    <Suspense>
      <DictionariesPage />
    </Suspense>
  );
}
