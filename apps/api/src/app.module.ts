import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt.guard';
import { UsersModule } from './users/users.module';
import { ApplicationsModule } from './applications/applications.module';
import { DictionariesModule } from './dictionaries/dictionaries.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { InboundModule } from './inbound/inbound.module';
import { HealthController } from './health.controller';
import { AllExceptionsFilter } from './common/exceptions.filter';

@Module({
  imports: [
    // A dashboard load is ~8 API calls; auth routes keep their own stricter limit
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    DictionariesModule,
    ApplicationsModule,
    AnalyticsModule,
    IntegrationsModule,
    InboundModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
