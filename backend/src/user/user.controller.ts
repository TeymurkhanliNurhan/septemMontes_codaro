import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

@ApiTags('User')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class UserController {
  constructor(private readonly userService: UserService) {}

  private getOrganizationId(req: any): string {
    return (req.user as { organizationId: string }).organizationId;
  }

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'List users in organization' })
  @ApiQuery({ name: 'id', required: false })
  @ApiResponse({ status: 200, type: [UserResponseDto] })
  async findAll(@Req() req: any, @Query('id') id?: string) {
    const organizationId = this.getOrganizationId(req);
    if (id) {
      return this.userService.findOne(id, organizationId);
    }
    return this.userService.findByOrganization(organizationId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create user' })
  @ApiResponse({ status: 201, type: UserResponseDto })
  create(@Req() req: any, @Body() dto: CreateUserDto) {
    return this.userService.create({
      ...dto,
      organizationId: dto.organizationId ?? this.getOrganizationId(req),
    });
  }

  @Patch()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  update(@Req() req: any, @Body() dto: UpdateUserDto) {
    return this.userService.update(dto, this.getOrganizationId(req));
  }

  @Delete()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete user' })
  @ApiQuery({ name: 'id', required: true })
  remove(@Req() req: any, @Query('id') id: string) {
    return this.userService.remove(id, this.getOrganizationId(req));
  }
}
