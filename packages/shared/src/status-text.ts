import type { AppStatus } from './enums';

/**
 * Board status labels and e-mail subjects → our statuses, in Russian, Ukrainian, English, German and French.
 * Order matters: negatives ("не просмотрен", "not selected") are checked before the words they contain,
 * and "отказаться/відмовитися від розсилки" in e-mail footers is not a rejection.
 */
const RULES: [RegExp, AppStatus][] = [
  [/не\s*просмотре[нл]|не\s*прочитан|не\s*рассмотрен|не\s*переглянут|not\s+(yet\s+)?viewed|unread|noch\s+nicht\s+angesehen|non\s+lue/i, 'APPLIED'],
  [
    /отказ(?!ать|ыва)|отклон[её]н|не\s*готов[ыа]?\s*(пригласить|предложить)|вакансия\s+(закрыта|в\s+архиве)|відмов(?!итися|лятися)|відхилен|not\s+selected|no\s+longer\s+(being\s+)?(considered|under\s+consideration)|not\s+(?:to\s+)?mov(?:e|ing)\s+forward|decided\s+to\s+(?:pursue|move\s+forward\s+with)\s+other|rejected|position\s+(was\s+)?filled|not\s+a\s+fit|unfortunately|absage|leider\s+(?:nicht|keine|können|müssen)|nicht\s+berücksichtig|candidature\s+(?:non\s+retenue|refusée)|pas\s+(?:été\s+)?retenue|malheureusement/i,
    'REJECTED',
  ],
  [/оффер|предложени[ея]\s+о\s+работе|пропозиці[яю]\s+про\s+роботу|job\s+offer|offer\s+(extended|received|made|letter)|stellenangebot\s+für\s+sie|promesse\s+d'embauche/i, 'OFFER'],
  [/тестовое|тестове\s+завдання|test\s+(task|assignment)|assessment|take[-\s]home|coding\s+challenge/i, 'TEST_TASK'],
  [/приглаш|собеседовани|интервью|запрош|співбесід|interview|invited|einladung|vorstellungsgespräch|entretien|invitation/i, 'INTERVIEW'],
  [/просмотре[нл]|прочитан|переглянув|переглянут|viewed|resume\s+downloaded|seen\s+by|angesehen|consultée/i, 'VIEWED'],
  [/откликнул|отклик\s+(?:отправлен|получен|доставлен)|ваш\s+отклик|резюме\s+(доставлено|отправлено)|відгукнул|application\s+(?:was\s+|has\s+been\s+)?(?:sent|received)|thank\s*s?\s+(?:you\s+)?for\s+(?:applying|your\s+application)|received\s+your\s+application|відгук\s+надіслано|applied|submitted|bewerbung\s+(?:ist\s+|wurde\s+)?(?:eingegangen|erhalten|gesendet)|candidature\s+(?:reçue|envoyée)/i, 'APPLIED'],
];

export function statusFromText(text: string): AppStatus | null {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return null;
  for (const [re, status] of RULES) if (re.test(t)) return status;
  return null;
}
