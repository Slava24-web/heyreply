import type { Metadata } from 'next';
import { authPageMetadata } from '@/lib/seo';
import { Suspense } from 'react';
import { ResetForm } from '@/components/auth-forms';

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => authPageMetadata(params, 'resetPassword', '/reset-password', true);

export default function Page() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
