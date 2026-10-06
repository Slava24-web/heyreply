import { HttpStatus, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AppError } from '../common/errors';
import { config } from '../config';

/**
 * Bounded concurrency with a bounded queue. Hashing is deliberately expensive, and every login attempt costs one
 * (even for unknown e-mails), so without a ceiling a flood from many IPs ties up the shared libuv threadpool
 * and everything else slows down with it. Over the ceiling we shed load instead of queueing forever.
 */
export class Gate {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(
    private readonly concurrency: number,
    private readonly maxQueue: number,
  ) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.concurrency) {
      if (this.waiting.length >= this.maxQueue) throw new AppError(HttpStatus.SERVICE_UNAVAILABLE, 'SERVER_BUSY');
      // The releasing task hands its slot straight to us, so `active` stays accurate
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else {
      this.active++;
    }
    try {
      return await fn();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active--;
    }
  }
}

@Injectable()
export class PasswordHasher {
  private readonly gate = new Gate(config().ARGON2_CONCURRENCY, config().ARGON2_QUEUE);

  hash(password: string) {
    return this.gate.run(() => argon2.hash(password));
  }

  verify(hash: string, password: string) {
    return this.gate.run(() => argon2.verify(hash, password));
  }

  needsRehash(hash: string) {
    return argon2.needsRehash(hash);
  }
}
