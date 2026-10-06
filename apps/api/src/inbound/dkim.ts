import { Injectable } from '@nestjs/common';
import { dkimVerify } from 'mailauth/lib/dkim/verify';
import type { DNSResolver } from 'mailauth';

export const DKIM_RESOLVER = Symbol('DKIM_RESOLVER');

@Injectable()
export class DkimVerifier {
  /** Tests inject a resolver that serves their own public key instead of real DNS. */
  constructor(private readonly resolver?: DNSResolver) {}

  /**
   * True when the message carries a valid DKIM signature by one of `domains`.
   * Auto-forwarding (Gmail/Yandex filters) keeps the original signature intact, so a board's
   * signature still verifies after forwarding; a forged "invitation" from anyone else does not.
   */
  async signedBy(raw: Buffer, domains: string[]): Promise<boolean> {
    try {
      const res = await dkimVerify(raw, this.resolver ? { resolver: this.resolver } : {});
      return res.results.some((r) => {
        const d = (r.signingDomain ?? '').toLowerCase();
        return r.status?.result === 'pass' && domains.some((x) => d === x || d.endsWith('.' + x));
      });
    } catch {
      return false;
    }
  }
}
