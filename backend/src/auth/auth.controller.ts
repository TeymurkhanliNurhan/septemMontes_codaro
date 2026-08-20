import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { AuthUser } from '../common/types/authenticated-request';
import { AuthService } from './auth.service';
import { LOGIN_RATE_LIMIT } from './auth.constants';
import { Client } from './decorators/client.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { AuthUserDto } from './dto/auth-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { SessionDto } from './dto/session.dto';
import { SessionCookieService } from './services/session-cookie.service';
import type { ClientInfo } from './types/client-info';

@ApiTags('Auth')
@ApiCookieAuth('session')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookies: SessionCookieService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ login: LOGIN_RATE_LIMIT })
  @ApiOperation({ summary: 'Log in and receive an httpOnly session cookie' })
  @ApiResponse({ status: HttpStatus.OK, type: AuthUserDto })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED })
  @ApiResponse({ status: HttpStatus.CONFLICT })
  async login(
    @Body() dto: LoginDto,
    @Client() client: ClientInfo,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUserDto> {
    const { user, session } = await this.authService.login(dto, client);
    this.cookies.write(response, session);
    return user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the current session' })
  async logout(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(user.sessionId);
    this.cookies.clear(response);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke every session belonging to this user' })
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ revoked: number }> {
    const revoked = await this.authService.logoutAll(user);
    this.cookies.clear(response);
    return { revoked };
  }

  @Get('me')
  @ApiOperation({ summary: 'The signed-in user' })
  @ApiResponse({ status: HttpStatus.OK, type: AuthUserDto })
  me(@CurrentUser() user: AuthUser): AuthUserDto {
    return this.authService.me(user);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Active sessions for the signed-in user' })
  @ApiResponse({ status: HttpStatus.OK, type: [SessionDto] })
  listSessions(@CurrentUser() user: AuthUser): Promise<SessionDto[]> {
    return this.authService.listSessions(user);
  }

  @Delete('sessions')
  @ApiOperation({ summary: 'Revoke one session belonging to this user' })
  @ApiQuery({ name: 'id', required: true })
  async revokeSession(
    @CurrentUser() user: AuthUser,
    @Query('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.revokeSession(user, id);
    if (id === user.sessionId) {
      this.cookies.clear(response);
    }
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ login: LOGIN_RATE_LIMIT })
  @ApiOperation({ summary: 'Change your own password' })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ revokedSessions: number }> {
    const revokedSessions = await this.authService.changePassword(user, dto);
    return { revokedSessions };
  }
}
