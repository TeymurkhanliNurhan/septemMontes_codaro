import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { ResourceStatus } from '../common/enums/resource-status.enum';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { ResourceService } from './resource.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { ResourceListQueryDto } from './dto/resource-list-query.dto';
import {
  ResourceDataResponseDto,
  ResourceListResponseDto,
} from './dto/resource-response.dto';

@ApiTags('Resource')
@Controller('resources')
@ApiCookieAuth('session')
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  private getOrganizationId(req: AuthenticatedRequest): string {
    return req.user.organizationId;
  }

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'List resources for the authenticated organization' })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Case-insensitive name search',
    example: 'Room',
  })
  @ApiQuery({
    name: 'resourceType',
    required: false,
    type: String,
    description: 'Filter by resource type',
    example: 'meeting_room',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ResourceStatus,
    description: 'Filter by status',
    example: ResourceStatus.ACTIVE,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (1-based)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (max 100)',
    example: 20,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['name', 'createdAt', 'updatedAt'],
    description: 'Sort field',
    example: 'createdAt',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort direction',
    example: 'desc',
  })
  @ApiResponse({ status: 200, type: ResourceListResponseDto })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: ResourceListQueryDto,
  ): Promise<ResourceListResponseDto> {
    return this.resourceService.findAll(this.getOrganizationId(req), query);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Get a resource by id' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Resource UUID',
    example: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  })
  @ApiResponse({ status: 200, type: ResourceDataResponseDto })
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResourceDataResponseDto> {
    const data = await this.resourceService.findOne(
      id,
      this.getOrganizationId(req),
    );
    return { data };
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a resource' })
  @ApiBody({
    type: CreateResourceDto,
    description: 'Resource fields (organizationId/status are set by the server)',
    examples: {
      room: {
        summary: 'Meeting room',
        value: {
          name: 'Room A',
          resourceType: 'meeting_room',
          metadata: { capacity: 8, floor: 2 },
        },
      },
      minimal: {
        summary: 'Name only',
        value: { name: 'Studio 1' },
      },
    },
  })
  @ApiResponse({ status: 201, type: ResourceDataResponseDto })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateResourceDto,
  ): Promise<ResourceDataResponseDto> {
    const data = await this.resourceService.create(
      dto,
      this.getOrganizationId(req),
    );
    return { data };
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update a resource (any editable field, including status)',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Resource UUID',
    example: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  })
  @ApiBody({
    type: UpdateResourceDto,
    description:
      'Send only fields to change. Cannot change id or organizationId.',
    examples: {
      rename: {
        summary: 'Rename',
        value: { name: 'Room A - Large' },
      },
      activate: {
        summary: 'Activate',
        value: { status: 'ACTIVE' },
      },
      deactivate: {
        summary: 'Deactivate',
        value: { status: 'INACTIVE' },
      },
      full: {
        summary: 'Update several fields',
        value: {
          name: 'Room A - Large',
          resourceType: 'meeting_room',
          status: 'ACTIVE',
          metadata: { capacity: 10, floor: 2 },
        },
      },
    },
  })
  @ApiResponse({ status: 200, type: ResourceDataResponseDto })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResourceDto,
  ): Promise<ResourceDataResponseDto> {
    const data = await this.resourceService.update(
      id,
      dto,
      this.getOrganizationId(req),
    );
    return { data };
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Hard-delete a resource when it has no booking links',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Resource UUID',
    example: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 409, description: 'Resource linked to bookings' })
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.resourceService.remove(id, this.getOrganizationId(req));
  }
}
