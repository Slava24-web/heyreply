import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LEGAL_DOCS } from '@/lib/legal';
import { cn } from '@/lib/utils';

/** Links to the legal documents; opens in a new tab by default so a half-filled form isn't lost. */
export function LegalLinks({ className, sameTab = false }: { className?: string; sameTab?: boolean }) {
  const t = useTranslations('legal');
  return (
    <nav aria-label={t('nav')} className={cn('flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-subtle', className)}>
      {LEGAL_DOCS.map((doc) => (
        <Link key={doc} href={`/${doc}`} className="hover:text-text hover:underline" {...(sameTab ? {} : { target: '_blank' })}>
          {t(doc)}
        </Link>
      ))}
    </nav>
  );
}
