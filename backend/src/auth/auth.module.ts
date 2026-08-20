import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordModule } from './password.module';
import { SessionModule } from './session.module';

@Module({
  imports: [SessionModule, PasswordModule, UserModule, OrganizationModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, SessionModule],
})
export class AuthModule {}
