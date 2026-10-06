import { LoginAttempts } from './login-attempts';

describe('LoginAttempts', () => {
  const email = 'owner@example.com';

  it('locks a client after 5 failures without locking the owner on another IP', () => {
    const a = new LoginAttempts();
    for (let i = 0; i < 5; i++) a.fail(email, '198.51.100.7');
    expect(a.isLocked(email, '198.51.100.7')).toBe(true);
    expect(a.isLocked(email, '203.0.113.1')).toBe(false);
  });

  it('caps distributed brute force per account across IPs', () => {
    const a = new LoginAttempts();
    for (let i = 0; i < 30; i++) a.fail(email, `10.0.0.${i}`);
    expect(a.isLocked(email, '203.0.113.1')).toBe(true);
  });

  it('expires counters after the window and resets on success', () => {
    const a = new LoginAttempts();
    const t0 = Date.now();
    for (let i = 0; i < 5; i++) a.fail(email, '1.1.1.1', t0);
    expect(a.isLocked(email, '1.1.1.1', t0)).toBe(true);
    expect(a.isLocked(email, '1.1.1.1', t0 + 16 * 60_000)).toBe(false);
    for (let i = 0; i < 4; i++) a.fail(email, '2.2.2.2');
    a.success(email, '2.2.2.2');
    a.fail(email, '2.2.2.2');
    expect(a.isLocked(email, '2.2.2.2')).toBe(false);
  });
});
