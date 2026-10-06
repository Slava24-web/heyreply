const escapeHtml = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const COPY = {
  ru: {
    subject: 'Сброс пароля heyreply',
    intro: 'Вы запросили сброс пароля в heyreply. Ссылка действует 1 час и работает один раз.',
    button: 'Задать новый пароль',
    ignore: 'Если это были не вы, просто проигнорируйте письмо: пароль не изменится.',
  },
  en: {
    subject: 'Reset your heyreply password',
    intro: 'You asked to reset your heyreply password. The link is valid for 1 hour and works once.',
    button: 'Set a new password',
    ignore: "If this wasn't you, ignore this e-mail: your password stays the same.",
  },
} as const;

export function passwordResetMail(locale: string, link: string) {
  const c = locale === 'en' ? COPY.en : COPY.ru;
  const text = `${c.intro}\n\n${link}\n\n${c.ignore}\n`;
  const html =
    `<p>${escapeHtml(c.intro)}</p>` +
    `<p><a href="${escapeHtml(link)}">${escapeHtml(c.button)}</a></p>` +
    `<p style="color:#666;font-size:13px">${escapeHtml(c.ignore)}</p>`;
  return { subject: c.subject, text, html };
}
