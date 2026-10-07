import type { Metadata } from 'next';
import { authPageMetadata } from '@/lib/seo';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth-forms';

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => authPageMetadata(params, 'login', '/login', true);

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <Suspense>
      <LoginForm locale={locale} />
    </Suspense>
  );
}
