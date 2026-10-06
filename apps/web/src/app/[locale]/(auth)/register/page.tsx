import { Suspense } from 'react';
import { RegisterForm } from '@/components/auth-forms';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <Suspense>
      <RegisterForm locale={locale} />
    </Suspense>
  );
}
