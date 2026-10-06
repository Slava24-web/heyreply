import { HttpStatus } from '@nestjs/common';
import { AppError } from '../common/errors';
import { config } from '../config';
import type { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';

/** Live (not deleted) applications count against the cap; archived ones still occupy space. */
export async function assertApplicationQuota(db: Prisma.TransactionClient | PrismaService, userId: string) {
  const used = await db.application.count({ where: { userId, deletedAt: null } });
  if (used >= config().MAX_APPLICATIONS_PER_USER) throw new AppError(HttpStatus.UNPROCESSABLE_ENTITY, 'APPLICATION_LIMIT');
}
