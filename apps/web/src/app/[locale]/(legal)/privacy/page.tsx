import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { LegalPage } from '@/components/legal/legal-page';
import { legalPageMetadata } from '@/lib/seo';

export const generateMetadata = ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => legalPageMetadata(params, 'privacy');

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage locale={locale} doc="privacy" />;
}
