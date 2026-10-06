import { buildMail, GMAIL_CONFIRMATION, HH_INVITATION, HH_REJECTION, LINKEDIN_REJECTED, LINKEDIN_SENT, LINKEDIN_VIEWED, NEWSLETTER, TRACKED_LINK } from '../../test/fixtures/mail';
import { detectConfirmation, extractApplication, readMail } from './mail-parser';
import { platformByMailDomain } from '@heyreply/shared';

const parse = async (m: Parameters<typeof buildMail>[0]) => {
  const facts = await readMail(Buffer.from(buildMail(m)));
  const platform = platformByMailDomain(facts.fromDomain);
  return { facts, platform, item: platform ? extractApplication(facts, platform) : null };
};

describe('e-mail parsing', () => {
  it('hh.ru invitation → INTERVIEW (footer "отказаться от рассылки" ignored)', async () => {
    const { platform, item } = await parse(HH_INVITATION);
    expect(platform).toBe('hh');
    expect(item).toMatchObject({ externalId: '134575860', companyName: 'Спортдата', positionName: 'Frontend-разработчик', status: 'INTERVIEW', vacancyUrl: 'https://hh.ru/vacancy/134575860' });
  });

  it('hh.ru rejection → REJECTED', async () => {
    expect((await parse(HH_REJECTION)).item).toMatchObject({ externalId: '777000111', companyName: 'Ozon Tech', positionName: 'React Developer', status: 'REJECTED' });
  });

  it('LinkedIn: sent / viewed / rejected', async () => {
    expect((await parse(LINKEDIN_SENT)).item).toMatchObject({ platform: 'linkedin', externalId: '4400000777', companyName: 'Miro', positionName: 'Senior Frontend Engineer', status: 'APPLIED' });
    expect((await parse(LINKEDIN_VIEWED)).item).toMatchObject({ externalId: '4400000888', companyName: 'Revolut', positionName: 'React Developer', status: 'VIEWED' });
    expect((await parse(LINKEDIN_REJECTED)).item).toMatchObject({ externalId: '4400000999', companyName: 'Wise', positionName: 'Staff Engineer', status: 'REJECTED' });
  });

  it('follows URL-encoded targets inside click-tracking links', async () => {
    const { platform, item } = await parse(TRACKED_LINK);
    expect(platform).toBe('habr');
    expect(item).toMatchObject({ externalId: '1000168750', companyName: 'IT-hunter', positionName: 'Head of Frontend', status: 'VIEWED' });
  });

  it('returns null for newsletters without a vacancy', async () => {
    const { platform, item } = await parse(NEWSLETTER);
    expect(platform).toBe('hh');
    expect(item).toBeNull();
  });

  it('extracts the Gmail forwarding confirmation code and link', async () => {
    const facts = await readMail(Buffer.from(buildMail(GMAIL_CONFIRMATION)));
    expect(detectConfirmation(facts)).toEqual({ code: '152430985', url: 'https://mail-settings.google.com/mail/vf-%5BANGjdJ8w%5D-abc123' });
  });

  it('does not treat board mail as a confirmation, nor provider links from strangers', async () => {
    expect(detectConfirmation(await readMail(Buffer.from(buildMail(HH_INVITATION))))).toBeNull();
    const fake = await readMail(Buffer.from(buildMail({ ...GMAIL_CONFIRMATION, from: 'Gmail Team <forwarding@evil.example>' })));
    expect(detectConfirmation(fake)).toBeNull();
  });
});
