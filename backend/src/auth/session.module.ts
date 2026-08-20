import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './entities/session.entity';
import { SessionCookieService } from './services/session-cookie.service';
import { SessionTokenService } from './services/session-token.service';
import { SessionService } from './services/session.service';

@Module({
  imports: [TypeOrmModule.forFeature([Session])],
  providers: [SessionService, SessionTokenService, SessionCookieService],
  exports: [SessionService, SessionCookieService],
})
export class SessionModule {}
