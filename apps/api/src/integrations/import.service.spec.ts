import { shouldApplyStatus } from './import.service';

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
