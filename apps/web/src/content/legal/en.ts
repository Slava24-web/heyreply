import type { LegalDoc, LegalDocKey, Operator } from '@/lib/legal';

const who = (o: Operator) => `${o.name}, ${o.address} (the “Operator”, “we”)`;

export const en: Record<LegalDocKey, (o: Operator) => LegalDoc> = {
  privacy: (o) => ({
    title: 'Privacy Policy',
    sections: [
      {
        title: '1. Who we are and what this policy covers',
        paragraphs: [
          `The controller of your personal data is ${who(o)}. Contact for data questions: ${o.email}.`,
          'This policy explains what data we process when you use the heyreply web app, the browser extension, why, for how long, and what rights you have. It applies together with the Terms of Service and the Consent to Personal Data Processing.',
        ],
      },
      {
        title: '2. What data we process',
        list: [
          'Account: name, e-mail address, password hash (we never store the password itself), interface language, theme, currency and other settings.',
          'Your applications: company, position, job board, city, work format, vacancy link, salary range and offer, dates, statuses and their history, tags, rejection reasons and notes. You enter them yourself, or the extension adds them on your behalf.',
          'Sessions and security: IP address and user-agent of your devices, sign-in and last-activity time, hashes of session tokens and integration tokens.',
          'Third-party data you enter yourself or that appears in job-board e-mails (for example a recruiter’s name in a subject line). Enter it only to the extent you need it to track your applications.',
        ],
      },
      {
        title: '3. Why we process it, and on what basis',
        list: [
          'Providing the service (application tracking, statistics, extension): performance of the Terms of Service and your consent.',
          'Security (brute-force protection, your device list, incident investigation): our legitimate interest in protecting the data.',
          'Complying with the law and answering your requests.',
        ],
        paragraphs: [
          'We do not use your data for advertising, do not sell it, do not profile you, and make no decisions with legal effect based solely on automated processing. The service contains no third-party analytics or advertising trackers.',
        ],
      },
      {
        title: '4. Browser extension',
        paragraphs: [
          'The extension only runs on the job-search and applicant-tracking sites it lists. When you apply for a vacancy or open a “My applications” page, it reads from that page the job title, company, link, location, salary, application status and the vacancy ID on that site. It does not read or send anything else on the page, including your CV, messages or profile data on that site.',
          'What it reads is sent only to the heyreply server whose address you entered when connecting, and only together with your personal token. The token and the queue of unsent records are kept in the extension’s local storage. You can switch off any site in the extension popup, revoke the token in settings, or remove the extension.',
          'The extension is not affiliated with, or endorsed by, the sites it reads. Their names belong to their owners.',
        ],
      },
      {
        title: '5. Cookies and local storage',
        paragraphs: ['We use strictly necessary cookies and local storage only. They are needed to run the service, so no consent is required for them. There are no advertising or analytics cookies.'],
        list: [
          'access_token (httpOnly): access to your account, up to 15 minutes.',
          'refresh_token (httpOnly): session renewal, up to 30 days.',
          'has_session: marks that you are signed in, up to 30 days.',
          'access_ok: marks that the access token is still valid, so the app knows when to renew it, up to 15 minutes.',
          'NEXT_LOCALE: your chosen interface language.',
          'Browser local storage: view preferences and the draft of the new-application form; cleared when you sign out.',
        ],
      },
      {
        title: '6. Who receives your data',
        paragraphs: ['We share data only with the infrastructure providers needed to run the service, under terms that require them to protect it and use it only on our instructions:'],
        list: [
          `Hosting provider (servers and database): ${o.hosting}.`,
          'Cloudflare, Inc. (USA): storing encrypted database backups (R2), where this feature is enabled.',
          'E-mail delivery provider (SMTP): sending the password-reset link to your e-mail address, where this feature is enabled.',
        ],
      },
      {
        title: '7. International transfers',
        paragraphs: [
          'The Operator is based in the Republic of Serbia and the service is open to users from many countries. The providers in section 6 may be located in, or process data in, countries other than yours, including countries whose data-protection level differs from that of Russia, Serbia or the EU. We transfer only what the service needs and use contractual safeguards (including standard contractual clauses) where the law requires. For users in Russia and in other countries where this is required, the transfer is based on your consent.',
          'We apply the same rules to all users. We follow Serbian data-protection law and the GDPR and, where applicable, the laws of the user’s country. Some countries’ laws (for example data-localisation rules) may require data to be stored differently; we deliberately do not host data separately for each country, and access to the service may therefore be restricted in such a country.',
        ],
      },
      {
        title: '8. How long we keep data',
        list: [
          'Account and application data: while you have an account. When you delete your account it is removed from the live database immediately.',
          'Applications you delete are kept for 30 days so that they can be restored, then removed permanently. For applications imported by the extension, only the vacancy ID on the board remains, so the vacancy is not added again.',
          'Sessions: ended and expired sessions are deleted within 7 days; an active session lasts up to 30 days. Revoked integration tokens are deleted after 30 days.',
          'Backups: kept encrypted for up to 30 days. Data of a deleted account disappears from backups when that period ends; if we restore from a backup we re-apply deletions.',
        ],
      },
      {
        title: '9. How we protect data',
        paragraphs: [
          'We use technical and organisational measures: encrypted connections (HTTPS), passwords stored only as argon2id hashes, tokens stored only as hashes, httpOnly cookies, protection against password guessing and request forgery, isolation of users’ data, and restricted server access. If a breach affects your rights, we will tell you and the competent authorities within the time limits set by law.',
        ],
      },
      {
        title: '10. Your rights',
        list: [
          'Know what data we process and get a copy: “Settings → Export data”.',
          'Correct your data: in your profile and in the applications themselves.',
          'Delete your account and all data: “Settings → Delete account”.',
          'Withdraw consent, restrict or object to processing: write to the address in section 1; withdrawing consent ends the account.',
          'Receive your data in a machine-readable format (JSON and CSV export).',
          'Complain to a data-protection authority: in the Republic of Serbia the Commissioner for Information of Public Importance and Personal Data Protection (poverenik.rs), for users in the EU/EEA the authority in your country, for users in Russia Roskomnadzor; or go to court.',
        ],
        paragraphs: ['We answer requests within the time set by law: up to 10 working days in Russia, up to one month in the EU and Serbia.'],
      },
      {
        title: '11. Age',
        paragraphs: ['The service is intended for people aged 16 and over. We do not knowingly collect data of younger children; if you learn of such a case, write to us and we will delete the data.'],
      },
      {
        title: '12. Changes to this policy',
        paragraphs: ['If we change the policy materially we will show a notice in the service and, where needed, ask for consent again. The edition date is shown at the top of the page.'],
      },
    ],
  }),

  terms: (o) => ({
    title: 'Terms of Service',
    sections: [
      {
        title: '1. General',
        paragraphs: [
          `These terms are an agreement between ${who(o)} and you as a user of heyreply: a web app for tracking job applications, a browser extension (the “Service”). By registering you accept these terms and the Privacy Policy.`,
          'The Service is free: no subscriptions, no ads, no paid features. The author may accept voluntary donations through a third-party service. A donation is not a payment for the Service, gives the user nothing in the Service, creates no obligation as to availability or quality, and is non-refundable.',
        ],
      },
      {
        title: '2. Your account',
        list: [
          'You must be at least 16. Provide a real e-mail address.',
          'You are responsible for keeping your password and integration tokens safe and for everything done under your account. If you suspect a breach, end all sessions in settings and tell us.',
          'One person, one account; do not hand your account to others.',
        ],
      },
      {
        title: '3. What the Service does',
        paragraphs: [
          'The Service helps you keep track of your applications and shows statistics. It is not an intermediary between you and employers, does not apply on your behalf, does not guarantee employment and does not vet vacancies or employers. Statistics are built from data entered by you or the extension, and may be inaccurate.',
        ],
      },
      {
        title: '4. Your data and rights in it',
        paragraphs: [
          'The data you put into the Service belongs to you. You grant us the right to store and process it solely to run the Service, as described in the Privacy Policy. You can export your data and delete your account at any time.',
          'You confirm that you enter data lawfully and do not infringe anyone’s rights. Do not enter other people’s data, or information not needed for tracking applications (passport data, health information and the like), without need.',
        ],
      },
      {
        title: '5. The extension and third-party sites',
        paragraphs: [
          'The extension reads job-site pages on your behalf, in your browser. Those sites (hh.ru, LinkedIn, Indeed and others) are not affiliated with heyreply and do not endorse it; their names and marks belong to their owners. Their terms may restrict automated reading of pages or use of extensions. You decide whether to enable the extension for each site and are responsible for complying with its rules. You can switch off any site in the extension popup. We are not responsible for restrictions placed on your account on third-party sites.',
        ],
      },
      {
        title: '6. Acceptable use',
        paragraphs: ['You must not:'],
        list: [
          'break the law or infringe the rights of others;',
          'try to access other people’s accounts or data, bypass limits or protections of the Service, or overload it;',
          'use the Service to send spam or to harvest other people’s data;',
          'copy, decompile or resell the Service unless its source-code licence allows it.',
        ],
      },
      {
        title: '7. Availability and no warranty',
        paragraphs: [
          'The Service is provided “as is”. We aim to keep it running and take backups, but we do not guarantee uninterrupted or error-free operation. We may change features, restrict access during maintenance and discontinue the Service, giving you notice where possible. Keep important data yourself too: use the export.',
        ],
      },
      {
        title: '8. Liability',
        paragraphs: [
          'To the extent permitted by law we are not liable for lost profit, lost job opportunities, indirect loss, or damage caused by your actions, by failures of third-party providers or by events beyond our control. Our total liability to you is limited to the amount you paid for the Service in the last 12 months; while the Service is free, to the minimum amount the law allows. This does not limit liability that cannot be limited by law, including consumer rights.',
        ],
      },
      {
        title: '9. Termination',
        paragraphs: [
          'You can delete your account in settings at any time. We may restrict or close an account if you breach these terms or the law, and will tell you why unless the law forbids it. After closure data is deleted as set out in the Privacy Policy.',
        ],
      },
      {
        title: '10. Changes',
        paragraphs: ['We may change these terms. We will announce material changes in the Service in advance. If you keep using the Service after they take effect you accept them; if you disagree, delete your account.'],
      },
      {
        title: '11. Governing law and disputes',
        paragraphs: [
          `These terms are governed by the law of the Republic of Serbia, unless mandatory rules of the country where you live as a consumer provide otherwise. We try to settle disputes by negotiation; send claims to ${o.email}. If that fails, the dispute is heard by the competent court of the Republic of Serbia, unless mandatory rules of your country provide otherwise.`,
        ],
      },
      { title: '12. Contact', paragraphs: [`${o.name}, ${o.address}. E-mail: ${o.email}.`] },
    ],
  }),

  consent: (o) => ({
    title: 'Consent to Personal Data Processing',
    sections: [
      {
        title: 'Who processes',
        paragraphs: [
          `By registering in heyreply and ticking the relevant box I freely, of my own will and in my own interest give consent to the operator, ${who(o)}, to process my personal data on the terms below and in the Privacy Policy.`,
        ],
      },
      {
        title: 'What data',
        paragraphs: [
          'Name, e-mail address, password hash, account settings, IP address and user-agent of my devices, details of my job applications (company, position, job board, location, salary expectations and offers, dates, statuses, notes, tags), and third-party data that I enter into the Service myself.',
        ],
      },
      {
        title: 'Purposes',
        list: [
          'giving me access to the Service and its features (application tracking, statistics, extension);',
          'keeping my account and the Service secure;',
          'contacting me about the Service and my requests;',
          'complying with the law.',
        ],
      },
      {
        title: 'Actions with data',
        paragraphs: [
          'Collection, recording, organisation, accumulation, storage, updating (changing), retrieval, use, transfer (granting access) to the persons named below, blocking, deletion and destruction, by automated means.',
        ],
      },
      {
        title: 'Processors and international transfer',
        list: [
          `Hosting provider: ${o.hosting}.`,
          'Cloudflare, Inc. (USA): storing backups.',
        ],
        paragraphs: [
          'I understand that these persons may be located and process data outside the Russian Federation, including in countries that do not ensure adequate protection of data subjects’ rights, and I consent to such cross-border transfer to the extent needed to run the Service.',
        ],
      },
      {
        title: 'Term and withdrawal',
        paragraphs: [
          `This consent lasts while I have an account and until the retention periods in the Privacy Policy end. I may withdraw it at any time by deleting my account in settings or writing to ${o.email}. After withdrawal the operator stops processing and deletes the data, except where the law requires it to be kept. Withdrawal makes further use of the Service impossible. It does not affect the lawfulness of processing before it was received.`,
        ],
      },
    ],
  }),
};
