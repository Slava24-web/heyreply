/** Builds an RFC 5322 message (multipart/alternative) for tests. */
export function buildMail(o: { from: string; to?: string; subject: string; html: string; text?: string; messageId?: string }) {
  const b = 'BOUNDARY_heyreply';
  const enc = (s: string) => `=?UTF-8?B?${Buffer.from(s).toString('base64')}?=`;
  return [
    `From: ${o.from}`,
    `To: ${o.to ?? 'user@gmail.com'}`,
    `Subject: ${enc(o.subject)}`,
    `Message-ID: ${o.messageId ?? `<${Math.random().toString(36).slice(2)}@test>`}`,
    'Date: Mon, 05 Oct 2026 10:00:00 +0000',
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${b}"`,
    '',
    `--${b}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(o.text ?? o.html.replace(/<[^>]+>/g, ' ')).toString('base64'),
    `--${b}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(o.html).toString('base64'),
    `--${b}--`,
    '',
  ].join('\r\n');
}

export const HH_INVITATION = {
  from: 'HeadHunter <noreply@hh.ru>',
  subject: 'Приглашение на вакансию «Frontend-разработчик»',
  html: `<p>Здравствуйте!</p><p>Работодатель <a href="https://hh.ru/employer/5551">ООО «Спортдата»</a> приглашает вас на собеседование
    по вакансии <a href="https://hh.ru/vacancy/134575860?utm_source=email&amp;utm_medium=invite">Frontend-разработчик</a>.</p>
    <p><a href="https://hh.ru/applicant/negotiations">Перейти к откликам</a></p>
    <p style="font-size:11px">Чтобы отказаться от рассылки, <a href="https://hh.ru/unsubscribe">нажмите здесь</a>.</p>`,
};

export const HH_REJECTION = {
  from: 'HeadHunter <noreply@hh.ru>',
  subject: 'Ответ по вакансии «React Developer»',
  html: `<p>К сожалению, работодатель <a href="https://hh.ru/employer/42">Ozon Tech</a> отказал вам по вакансии
    <a href="https://hh.ru/vacancy/777000111">React Developer</a>.</p><p>Отказаться от рассылки можно в настройках.</p>`,
};

export const LINKEDIN_SENT = {
  from: 'LinkedIn <jobs-noreply@linkedin.com>',
  subject: 'Your application was sent to Miro',
  html: `<h2>Your application was sent to Miro</h2>
    <a href="https://www.linkedin.com/comm/jobs/view/4400000777/?trackingId=abc&amp;refId=x">Senior Frontend Engineer</a>
    <p>Miro · Amsterdam (Remote)</p><a href="https://www.linkedin.com/comm/jobs/view/4400000777/">View job</a>`,
};

export const LINKEDIN_VIEWED = {
  from: 'LinkedIn <jobs-noreply@linkedin.com>',
  subject: 'Your application was viewed by Revolut',
  html: `<p>Your application was viewed by Revolut</p><a href="https://www.linkedin.com/comm/jobs/view/4400000888/">React Developer</a>`,
};

export const LINKEDIN_REJECTED = {
  from: 'LinkedIn <jobs-noreply@linkedin.com>',
  subject: 'Your application to Staff Engineer at Wise',
  html: `<p>Thank you for your interest. Unfortunately, Wise has decided not to move forward with your application.</p>
    <a href="https://www.linkedin.com/comm/jobs/view/4400000999/">Staff Engineer</a>`,
};

export const TRACKED_LINK = {
  from: 'Хабр Карьера <noreply@career.habr.com>',
  subject: 'Компания IT-hunter просмотрела ваш отклик',
  html: `<p>Компания IT-hunter просмотрела ваш отклик на вакансию
    <a href="https://click.mailer.example/ls/click?u=https%3A%2F%2Fcareer.habr.com%2Fvacancies%2F1000168750%3Futm%3Dmail">Head of Frontend</a></p>`,
};

export const NEWSLETTER = {
  from: 'HeadHunter <news@hh.ru>',
  subject: 'Подборка вакансий для вас',
  html: `<p>Новые вакансии по вашему резюме. <a href="https://hh.ru/search/vacancy?text=react">Смотреть</a></p>`,
};

export const GMAIL_CONFIRMATION = {
  from: 'Gmail Team <forwarding-noreply@google.com>',
  subject: '(#152430985) Gmail Forwarding Confirmation - Receive Mail from user@gmail.com',
  html: `<p>user@gmail.com has requested to automatically forward mail to your email address.</p>
    <p>Confirmation code: 152430985</p>
    <p>To allow user@gmail.com to automatically forward mail to your address, please click the link below to confirm the request:</p>
    <a href="https://mail-settings.google.com/mail/vf-%5BANGjdJ8w%5D-abc123">https://mail-settings.google.com/mail/vf-%5BANGjdJ8w%5D-abc123</a>`,
};

/* ---------- the 20 added platforms ---------- */

export const GREENHOUSE_CONFIRM = {
  from: 'GitLab Hiring Team <no-reply@us.greenhouse-mail.io>',
  subject: 'Thank you for applying to GitLab',
  html: `<p>Hi Alex,</p><p>Thank you for your interest in the Account Executive - France position at GitLab. We have received your application and will review it shortly.</p>`,
};

export const LEVER_CONFIRM = {
  from: 'Spotify <no-reply@hire.lever.co>',
  subject: 'Thanks for applying to Spotify',
  html: `<p>Thank you for your interest in the Android Engineer - Experience role at Spotify.</p>
    <p><a href="https://jobs.lever.co/spotify/2193db3f-77c5-43b8-b030-8f92c9882bf1">Android Engineer - Experience</a></p>`,
};

export const WORKABLE_REJECT = {
  from: 'Hugging Face <noreply@candidates.workablemail.com>',
  subject: 'Your application for ML Engineer at Hugging Face',
  html: `<p>Thank you for applying for the ML Engineer position at Hugging Face. Unfortunately, we have decided to move forward with other candidates.</p>`,
};

export const ASHBY_INTERVIEW = {
  from: 'Ramp Recruiting <no-reply@ashbyhq.com>',
  subject: 'Interview invitation: Security Engineer, Cloud at Ramp',
  html: `<p>We'd love to invite you to an interview for the Security Engineer, Cloud role at Ramp.</p>`,
};

export const DJINNI_VIEWED = {
  from: 'Djinni <noreply@djinni.co>',
  subject: 'Роботодавець переглянув ваш відгук',
  html: `<p>Компанія Olive переглянула ваш відгук на вакансію <a href="https://djinni.co/jobs/850116-full-stack-shopify-developer/">Full Stack Shopify Developer</a>.</p>`,
};

export const WORKUA_INVITE = {
  from: 'Work.ua <noreply@work.ua>',
  subject: 'Запрошення на співбесіду: «Frontend-розробник»',
  html: `<p>Роботодавець <a href="https://www.work.ua/jobs/by-company/12345/">ТОВ «Сонечко»</a> запрошує вас на співбесіду за вакансією
    <a href="https://www.work.ua/jobs/5412345/">Frontend-розробник</a>.</p><p>Відмовитися від розсилки</p>`,
};

export const AVITO_REJECT = {
  from: 'Авито <noreply@avito.ru>',
  subject: 'Ответ на ваш отклик «Курьер»',
  html: `<p>К сожалению, работодатель <a href="https://www.avito.ru/brands/ozon">Ozon</a> отказал по вакансии
    <a href="https://www.avito.ru/moskva/vakansii/kurer_4012345678">Курьер</a>.</p>`,
};

export const STEPSTONE_ABSAGE = {
  from: 'StepStone <noreply@stepstone.de>',
  subject: 'Absage: Frontend Entwickler',
  html: `<p>Leider können wir Ihre Bewerbung als <a href="https://www.stepstone.de/stellenangebote--Frontend-Entwickler-Berlin-Acme--12345678-inline.html">Frontend Entwickler</a>
    bei der Firma Acme nicht berücksichtigen.</p><p>Arbeitgeber Acme GmbH</p>`,
};

export const GLASSDOOR_ALERT = {
  from: 'Glassdoor Jobs <noreply@glassdoor.com>',
  subject: 'Jobs for you: Frontend Engineer at Stripe and 9 more',
  html: `<p><a href="https://www.glassdoor.com/job-listing/frontend-stripe?jl=1009412345678">Frontend Engineer</a> at Stripe</p>`,
};

export const HH_DIGEST_WITH_LINKS = {
  from: 'HeadHunter <noreply@hh.ru>',
  subject: 'Новые вакансии для вас: Frontend-разработчик',
  html: `<p>Компания Яндекс: <a href="https://hh.ru/vacancy/111222333">Frontend-разработчик</a></p>`,
};
