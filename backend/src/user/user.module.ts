import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordModule } from '../auth/password.module';
import { SessionModule } from '../auth/session.module';
import { User } from './entities/user.entity';
import { UserAccessPolicy } from './user-access.policy';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), PasswordModule, SessionModule],
  controllers: [UserController],
  providers: [UserService, UserAccessPolicy],
  exports: [UserService],
})
export class UserModule {}
