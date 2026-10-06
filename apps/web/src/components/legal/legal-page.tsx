import { getTranslations } from 'next-intl/server';
import { en } from '@/content/legal/en';
import { ru } from '@/content/legal/ru';
import { getOperator, legalEdition, type LegalDocKey } from '@/lib/legal';

export async function LegalPage({ locale, doc }: { locale: string; doc: LegalDocKey }) {
  const t = await getTranslations({ locale, namespace: 'legal' });
  const content = (locale === 'ru' ? ru : en)[doc](getOperator(locale));
  return (
    <article>
      <h1 className="font-display text-[clamp(26px,4vw,34px)] font-medium tracking-[-0.02em]">{content.title}</h1>
      <p className="mt-2 text-sm text-subtle">{t('edition', { date: legalEdition(locale) })}</p>
      <div className="mt-8 flex flex-col gap-8">
        {content.sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-[17px] font-semibold">{s.title}</h2>
            <div className="mt-2 flex flex-col gap-3 text-[15px] leading-relaxed text-muted">
              {s.paragraphs?.map((p) => <p key={p}>{p}</p>)}
              {s.list ? (
                <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-subtle">
                  {s.list.map((li) => <li key={li}>{li}</li>)}
                </ul>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
