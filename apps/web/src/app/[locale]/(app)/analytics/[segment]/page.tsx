import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { AnalyticsPage, type SegmentKind } from '@/components/analytics/analytics-page';

const SEGMENTS: SegmentKind[] = ['sources', 'positions', 'locations', 'salary'];

export function generateStaticParams() {
  return SEGMENTS.map((segment) => ({ segment }));
}

export async function generateMetadata({ params }: { params: Promise<{ segment: string; locale: string }> }) {
  const { segment, locale } = await params;
  const t = await getTranslations({ locale, namespace: 'analytics' });
  const key = ({ sources: 'sourcesTitle', positions: 'positionsTitle', locations: 'locationsTitle', salary: 'salaryTitle' } as const)[segment as SegmentKind];
  return { title: key ? t(key) : t('title') };
}

export default async function Page({ params }: { params: Promise<{ segment: string }> }) {
  const { segment } = await params;
  if (!SEGMENTS.includes(segment as SegmentKind)) notFound();
  return (
    <Suspense>
      <AnalyticsPage segment={segment as SegmentKind} />
    </Suspense>
  );
}
