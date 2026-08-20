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
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { AttachResourceToServiceDto } from './dto/attach-resource-to-service.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { ServiceQueryDto } from './dto/service-query.dto';
import {
  ServiceDataResponseDto,
  ServiceLinkedResourceListResponseDto,
  ServiceListResponseDto,
  ServiceResourceDataResponseDto,
} from './dto/service-response.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServiceService } from './service.service';

@ApiTags('Service')
@Controller('services')
@ApiCookieAuth('session')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  private getOrganizationId(req: AuthenticatedRequest): string {
    return req.user.organizationId;
  }

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({
    summary:
      'Query services: list, get by id, or list linked resources via query options',
  })
  @ApiQuery({ name: 'id', required: false, type: String, format: 'uuid' })
  @ApiQuery({
    name: 'include',
    required: false,
    enum: ['resources'],
    description: 'With id: return linked resources',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ACTIVE', 'INACTIVE'],
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['name', 'durationMinutes', 'createdAt', 'updatedAt'],
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200, type: ServiceListResponseDto })
  @ApiResponse({ status: 200, type: ServiceDataResponseDto })
  @ApiResponse({ status: 200, type: ServiceLinkedResourceListResponseDto })
  query(
    @Req() req: AuthenticatedRequest,
    @Query() query: ServiceQueryDto,
  ): Promise<
    | ServiceListResponseDto
    | ServiceDataResponseDto
    | ServiceLinkedResourceListResponseDto
  > {
    return this.serviceService.query(this.getOrganizationId(req), query);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a service' })
  @ApiBody({
    type: CreateServiceDto,
    description:
      'Service fields (organizationId/isActive are set by the server)',
    examples: {
      consultation: {
        summary: 'Consultation',
        value: {
          name: '60 Minute Consultation',
          description: 'Standard consultation',
          durationMinutes: 60,
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: 15,
          metadata: {},
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: ServiceDataResponseDto })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateServiceDto,
  ): Promise<ServiceDataResponseDto> {
    const data = await this.serviceService.create(
      dto,
      this.getOrganizationId(req),
    );
    return { data };
  }

  @Patch()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Update a service (fields, isActive, and/or replace resourceIds)',
  })
  @ApiBody({
    type: UpdateServiceDto,
    examples: {
      rename: {
        summary: 'Rename',
        value: {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          name: '90 Minute Consultation',
        },
      },
      deactivate: {
        summary: 'Deactivate',
        value: {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          isActive: false,
        },
      },
      resources: {
        summary: 'Replace linked resources',
        value: {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          resourceIds: ['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'],
        },
      },
    },
  })
  @ApiResponse({ status: 200, type: ServiceDataResponseDto })
  async update(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateServiceDto,
  ): Promise<ServiceDataResponseDto> {
    const data = await this.serviceService.update(
      dto,
      this.getOrganizationId(req),
    );
    return { data };
  }

  @Delete()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Hard-delete a service when it has no booking links',
  })
  @ApiQuery({
    name: 'id',
    required: true,
    type: String,
    format: 'uuid',
  })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 409, description: 'Service linked to bookings' })
  remove(
    @Req() req: AuthenticatedRequest,
    @Query('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.serviceService.remove(id, this.getOrganizationId(req));
  }

  @Get(':serviceId/resources')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({
    summary: 'List resources linked to a service in the current organization',
  })
  @ApiParam({ name: 'serviceId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, type: ServiceLinkedResourceListResponseDto })
  listResources(
    @Req() req: AuthenticatedRequest,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ): Promise<ServiceLinkedResourceListResponseDto> {
    return this.serviceService.listResources(
      serviceId,
      this.getOrganizationId(req),
    );
  }

  @Post(':serviceId/resources')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Attach a resource to a service' })
  @ApiParam({ name: 'serviceId', type: String, format: 'uuid' })
  @ApiBody({ type: AttachResourceToServiceDto })
  @ApiResponse({ status: 201, type: ServiceResourceDataResponseDto })
  @ApiResponse({ status: 409, description: 'Relationship already exists' })
  async attachResource(
    @Req() req: AuthenticatedRequest,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() dto: AttachResourceToServiceDto,
  ): Promise<ServiceResourceDataResponseDto> {
    const data = await this.serviceService.attachResource(
      serviceId,
      dto.resourceId,
      this.getOrganizationId(req),
    );
    return { data };
  }

  @Delete(':serviceId/resources/:resourceId')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Detach a resource from a service (does not delete the resource)',
  })
  @ApiParam({ name: 'serviceId', type: String, format: 'uuid' })
  @ApiParam({ name: 'resourceId', type: String, format: 'uuid' })
  @ApiResponse({ status: 204 })
  detachResource(
    @Req() req: AuthenticatedRequest,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
  ): Promise<void> {
    return this.serviceService.detachResource(
      serviceId,
      resourceId,
      this.getOrganizationId(req),
    );
  }
}
