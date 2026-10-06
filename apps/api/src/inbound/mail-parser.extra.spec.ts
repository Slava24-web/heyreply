import { platformByMailDomain } from '@heyreply/shared';
import {
  ASHBY_INTERVIEW, AVITO_REJECT, buildMail, DJINNI_VIEWED, GLASSDOOR_ALERT, GREENHOUSE_CONFIRM, HH_DIGEST_WITH_LINKS,
  LEVER_CONFIRM, STEPSTONE_ABSAGE, WORKABLE_REJECT, WORKUA_INVITE,
} from '../../test/fixtures/mail';
import { extractApplication, readMail, syntheticId } from './mail-parser';

const parse = async (m: Parameters<typeof buildMail>[0]) => {
  const facts = await readMail(Buffer.from(buildMail(m)));
  const platform = platformByMailDomain(facts.fromDomain);
  return { platform, item: platform ? extractApplication(facts, platform) : null };
};

describe('e-mail parsing — added platforms', () => {
  it('Greenhouse confirmation without a job link → derived id from company + position', async () => {
    const { platform, item } = await parse(GREENHOUSE_CONFIRM);
    expect(platform).toBe('greenhouse');
    expect(item).toMatchObject({ companyName: 'GitLab', positionName: 'Account Executive - France', status: 'APPLIED', vacancyUrl: null });
    expect(item?.externalId).toBe(syntheticId('GitLab', 'Account Executive - France'));
  });

  it('Lever confirmation with a job link keeps the real id', async () => {
    const { platform, item } = await parse(LEVER_CONFIRM);
    expect(platform).toBe('lever');
    expect(item).toMatchObject({ externalId: 'spotify/2193db3f-77c5-43b8-b030-8f92c9882bf1', companyName: 'Spotify', positionName: 'Android Engineer - Experience', status: 'APPLIED' });
  });

  it('Workable rejection and Ashby interview', async () => {
    expect((await parse(WORKABLE_REJECT)).item).toMatchObject({ platform: 'workable', companyName: 'Hugging Face', positionName: 'ML Engineer', status: 'REJECTED' });
    expect((await parse(ASHBY_INTERVIEW)).item).toMatchObject({ platform: 'ashby', companyName: 'Ramp', positionName: 'Security Engineer, Cloud', status: 'INTERVIEW' });
  });

  it('Ukrainian: Djinni viewed, Work.ua invitation (unsubscribe footer ignored)', async () => {
    expect((await parse(DJINNI_VIEWED)).item).toMatchObject({ platform: 'djinni', externalId: '850116', positionName: 'Full Stack Shopify Developer', status: 'VIEWED' });
    expect((await parse(WORKUA_INVITE)).item).toMatchObject({ platform: 'workua', externalId: '5412345', companyName: 'Сонечко', positionName: 'Frontend-розробник', status: 'INTERVIEW' });
  });

  it('Avito rejection and StepStone Absage', async () => {
    expect((await parse(AVITO_REJECT)).item).toMatchObject({ platform: 'avito', externalId: '4012345678', positionName: 'Курьер', status: 'REJECTED' });
    expect((await parse(STEPSTONE_ABSAGE)).item).toMatchObject({ platform: 'stepstone', externalId: '12345678', positionName: 'Frontend Entwickler', status: 'REJECTED' });
  });

  it('never imports job alerts and digests, even with vacancy links', async () => {
    expect((await parse(GLASSDOOR_ALERT)).item).toBeNull();
    expect((await parse(HH_DIGEST_WITH_LINKS)).item).toBeNull();
  });
});
