import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

import {
  lockMedia,
  protectSavedReferences,
} from '../uploads/upload-references';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /** Serialize reference-changing writes with cleanup claims across API processes. */
  async mediaWrite<T>(
    write: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(
      async (tx) => {
        await lockMedia(tx);
        const result = await write(tx);
        await protectSavedReferences(
          tx,
          new URL(process.env.PUBLIC_BASE_URL!).origin,
        );
        return result;
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
