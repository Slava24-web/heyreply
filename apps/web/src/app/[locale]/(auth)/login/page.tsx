import { Suspense } from 'react';
import { LoginForm } from '@/components/auth-forms';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <Suspense>
      <LoginForm locale={locale} />
    </Suspense>
  );
}
