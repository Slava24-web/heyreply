import { shouldApplyStatus, webVacancyId } from './import.service';

describe('shouldApplyStatus', () => {
  it('moves forward along the funnel', () => {
    expect(shouldApplyStatus('APPLIED', 1, 'VIEWED')).toBe(true);
    expect(shouldApplyStatus('VIEWED', 1, 'INTERVIEW')).toBe(true);
    expect(shouldApplyStatus('SCREENING', 2, 'REJECTED')).toBe(true);
  });

  it('never moves backwards or repeats', () => {
    expect(shouldApplyStatus('INTERVIEW', 4, 'VIEWED')).toBe(false);
    expect(shouldApplyStatus('VIEWED', 1, 'APPLIED')).toBe(false);
    expect(shouldApplyStatus('INTERVIEW', 4, 'INTERVIEW')).toBe(false);
  });

  it('does not overwrite a final status set by the user', () => {
    expect(shouldApplyStatus('OFFER', 5, 'REJECTED')).toBe(false);
    expect(shouldApplyStatus('REJECTED', 1, 'INTERVIEW')).toBe(false);
    expect(shouldApplyStatus('DECLINED', 1, 'VIEWED')).toBe(false);
  });
});

describe('webVacancyId', () => {
  it('ignores tracking parameters, hash, www and the trailing slash', () => {
    expect(webVacancyId('https://www.Careers.example.com/jobs/123-frontend/?utm_source=x#apply')).toBe('careers.example.com/jobs/123-frontend');
    expect(webVacancyId('https://careers.example.com/jobs/123-frontend')).toBe('careers.example.com/jobs/123-frontend');
  });

  it('fits the 120-character id limit, keeping the specific tail', () => {
    const id = webVacancyId(`https://example.com/${'a'.repeat(200)}/job-42`);
    expect(id).toHaveLength(120);
    expect(id.endsWith('/job-42')).toBe(true);
  });
});
