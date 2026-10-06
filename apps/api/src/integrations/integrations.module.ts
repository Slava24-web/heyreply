import { Module } from '@nestjs/common';
import { DictionariesModule } from '../dictionaries/dictionaries.module';
import { ImportController, TokensController } from './integrations.controller';
import { ImportService } from './import.service';
import { ApiTokenGuard } from './token.guard';
import { TokensService } from './tokens.service';

@Module({
  imports: [DictionariesModule],
  controllers: [TokensController, ImportController],
  providers: [TokensService, ImportService, ApiTokenGuard],
  exports: [ImportService],
})
export class IntegrationsModule {}
