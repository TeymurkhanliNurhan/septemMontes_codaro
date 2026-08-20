import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { ResourceService } from './resource.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { ResourceResponseDto } from './dto/resource-response.dto';

@ApiTags('Resource')
@Controller('resources')
@ApiCookieAuth('session')
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'List resources' })
  @ApiQuery({ name: 'id', required: false })
  @ApiResponse({ status: 200, type: [ResourceResponseDto] })
  findAll(@Req() req: AuthenticatedRequest, @Query('id') id?: string) {
    const organizationId = req.user.organizationId;
    if (id) return this.resourceService.findOne(id);
    return this.resourceService.findByOrganization(organizationId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Create resource' })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateResourceDto) {
    const organizationId = req.user.organizationId;
    return this.resourceService.create(dto, organizationId);
  }

  @Patch()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  update(@Body() dto: UpdateResourceDto) {
    return this.resourceService.update(dto);
  }

  @Delete()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiQuery({ name: 'id', required: true })
  remove(@Query('id') id: string) {
    return this.resourceService.remove(id);
  }
}
