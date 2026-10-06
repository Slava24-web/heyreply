import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { DkimVerifier } from './dkim';
import { InboundSettingsController, InboundWebhookController } from './inbound.controller';
import { InboundService } from './inbound.service';

@Module({
  imports: [IntegrationsModule],
  controllers: [InboundSettingsController, InboundWebhookController],
  providers: [InboundService, { provide: DkimVerifier, useFactory: () => new DkimVerifier() }],
})
export class InboundModule {}
