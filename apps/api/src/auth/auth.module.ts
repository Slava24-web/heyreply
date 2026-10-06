import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginAttempts } from './login-attempts';
import { DictionariesModule } from '../dictionaries/dictionaries.module';

@Module({
  imports: [JwtModule.register({}), DictionariesModule],
  controllers: [AuthController],
  providers: [AuthService, LoginAttempts],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
