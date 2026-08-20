import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordModule } from './password.module';
import { SessionModule } from './session.module';

@Module({
  imports: [SessionModule, PasswordModule, UserModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, SessionModule],
})
export class AuthModule {}
