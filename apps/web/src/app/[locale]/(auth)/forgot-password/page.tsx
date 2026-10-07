import type { Metadata } from 'next';
import { authPageMetadata } from '@/lib/seo';
import { ForgotForm } from '@/components/auth-forms';

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => authPageMetadata(params, 'forgotPassword', '/forgot-password', true);

export default function Page() {
  return <ForgotForm />;
}
