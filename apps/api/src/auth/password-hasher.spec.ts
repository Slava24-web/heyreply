import { Gate } from './password-hasher';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};
const tick = () => new Promise((r) => setImmediate(r));

describe('Gate', () => {
  it('never runs more than `concurrency` tasks at once and starts queued ones as slots free up', async () => {
    const gate = new Gate(2, 10);
    let running = 0;
    let peak = 0;
    const doors = Array.from({ length: 5 }, deferred);
    const tasks = doors.map((d) =>
      gate.run(async () => {
        peak = Math.max(peak, ++running);
        await d.promise;
        running--;
      }),
    );
    await tick();
    expect(running).toBe(2);
    doors[0].resolve();
    await tick();
    expect(running).toBe(2);
    doors.slice(1).forEach((d) => d.resolve());
    await Promise.all(tasks);
    expect(peak).toBe(2);
    expect(running).toBe(0);
  });

  it('rejects with 503 SERVER_BUSY once the queue is full, without disturbing running tasks', async () => {
    const gate = new Gate(1, 1);
    const hold = deferred();
    const first = gate.run(() => hold.promise);
    const queued = gate.run(async () => 'queued');
    await tick();
    await expect(gate.run(async () => 'overflow')).rejects.toMatchObject({ status: 503 });
    hold.resolve();
    await first;
    await expect(queued).resolves.toBe('queued');
  });

  it('frees the slot when a task throws', async () => {
    const gate = new Gate(1, 0);
    await expect(gate.run(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(gate.run(async () => 'ok')).resolves.toBe('ok');
  });
});
