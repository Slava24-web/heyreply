import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { AuthModule } from '../auth/auth.module';
import { ApplicationsModule } from '../applications/applications.module';

@Module({ imports: [AuthModule, ApplicationsModule], controllers: [UsersController] })
export class UsersModule {}
