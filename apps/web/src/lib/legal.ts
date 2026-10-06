import { LEGAL_VERSION } from '@heyreply/shared';

export type LegalDocKey = 'privacy' | 'terms' | 'consent';
export const LEGAL_DOCS: readonly LegalDocKey[] = ['privacy', 'terms', 'consent'];

export type LegalDoc = {
  title: string;
  sections: { title: string; paragraphs?: string[]; list?: string[] }[];
};

/** Who runs the service. Taken from the environment so the documents never ship with someone else's details. */
export type Operator = { name: string; address: string; email: string; hosting: string };

export function getOperator(locale: string): Operator {
  const missing = locale === 'ru' ? '[не указано]' : '[not specified]';
  const env = process.env;
  return {
    name: env.LEGAL_OPERATOR_NAME || missing,
    address: env.LEGAL_OPERATOR_ADDRESS || missing,
    email: env.LEGAL_CONTACT_EMAIL || missing,
    hosting: env.LEGAL_HOSTING || missing,
  };
}

/** Edition date of the documents, formatted for the reader (LEGAL_VERSION is an ISO date). */
export function legalEdition(locale: string) {
  return new Date(`${LEGAL_VERSION}T00:00:00Z`).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
