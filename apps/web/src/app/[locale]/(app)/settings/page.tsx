import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { SettingsPage } from '@/components/settings/settings-page';

export async function generateMetadata() {
  const t = await getTranslations('settings');
  return { title: t('title') };
}

export default function Page() {
  return (
    <Suspense>
      <SettingsPage />
    </Suspense>
  );
}
