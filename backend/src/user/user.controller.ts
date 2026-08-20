import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { AuthUser } from '../common/types/authenticated-request';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserService } from './user.service';

@ApiTags('User')
@ApiCookieAuth('session')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'List users in your organization' })
  @ApiQuery({ name: 'id', required: false })
  @ApiResponse({ status: HttpStatus.OK, type: [UserResponseDto] })
  findAll(
    @CurrentUser() actor: AuthUser,
    @Query('id') id?: string,
  ): Promise<UserResponseDto | UserResponseDto[]> {
    return id
      ? this.userService.findOne(id, actor.organizationId)
      : this.userService.findByOrganization(actor.organizationId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a user in your organization' })
  @ApiResponse({ status: HttpStatus.CREATED, type: UserResponseDto })
  create(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreateUserDto,
  ): Promise<UserResponseDto> {
    return this.userService.create(dto, actor);
  }

  @Patch()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a user' })
  @ApiResponse({ status: HttpStatus.OK, type: UserResponseDto })
  update(
    @CurrentUser() actor: AuthUser,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.userService.update(dto, actor);
  }

  @Delete()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiQuery({ name: 'id', required: true })
  remove(
    @CurrentUser() actor: AuthUser,
    @Query('id') id: string,
  ): Promise<void> {
    return this.userService.remove(id, actor);
  }
}
