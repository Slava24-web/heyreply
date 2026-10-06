import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { config } from '../config';
import { passwordResetMail } from './templates';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transport: Transporter | null | undefined;

  /** Null when SMTP is not configured: the API still works, but no e-mail leaves the server. */
  private getTransport(): Transporter | null {
    if (this.transport === undefined) {
      const url = config().SMTP_URL;
      this.transport = url ? createTransport({ url, connectionTimeout: 10_000, socketTimeout: 15_000 } as Parameters<typeof createTransport>[0]) : null;
      if (!url) this.logger.warn('SMTP_URL is not set: password reset e-mails are not sent');
    }
    return this.transport;
  }

  async sendPasswordReset(to: string, locale: string, link: string) {
    const transport = this.getTransport();
    if (!transport) {
      // The link is a credential, so it is only printed outside production
      if (!config().isProd) this.logger.log(`[dev] Password reset link for ${to}: ${link}`);
      return;
    }
    const mail = passwordResetMail(locale, link);
    await transport.sendMail({ from: config().MAIL_FROM, to, subject: mail.subject, text: mail.text, html: mail.html });
  }
}
