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
import { AvailabilityExceptionType } from '../common/enums/availability-exception-type.enum';
import { UserRole } from '../common/enums/user-role.enum';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { AvailabilityExceptionService } from './availability-exception.service';
import { CreateAvailabilityExceptionDto } from './dto/create-exception.dto';
import { UpdateAvailabilityExceptionDto } from './dto/update-exception.dto';
import { AvailabilityExceptionListQueryDto } from './dto/exception-list-query.dto';
import {
  AvailabilityExceptionDataResponseDto,
  AvailabilityExceptionListResponseDto,
} from './dto/exception-response.dto';

@ApiTags('AvailabilityException')
@Controller('resources/:resourceId/availability/exceptions')
@ApiCookieAuth('session')
export class AvailabilityExceptionController {
  constructor(
    private readonly availabilityExceptionService: AvailabilityExceptionService,
  ) {}

  private getOrganizationId(req: AuthenticatedRequest): string {
    return req.user.organizationId;
  }

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({
    summary:
      'List availability exceptions for a resource in the current organization',
  })
  @ApiParam({ name: 'resourceId', type: String, format: 'uuid' })
  @ApiQuery({ name: 'from', required: false, example: '2026-08-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-08-31' })
  @ApiQuery({
    name: 'exceptionType',
    required: false,
    enum: AvailabilityExceptionType,
  })
  @ApiResponse({ status: 200, type: AvailabilityExceptionListResponseDto })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Query() query: AvailabilityExceptionListQueryDto,
  ): Promise<AvailabilityExceptionListResponseDto> {
    return this.availabilityExceptionService.findAll(
      resourceId,
      this.getOrganizationId(req),
      query,
    );
  }

  @Get(':exceptionId')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Get a single availability exception' })
  @ApiParam({ name: 'resourceId', type: String, format: 'uuid' })
  @ApiParam({ name: 'exceptionId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, type: AvailabilityExceptionDataResponseDto })
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Param('exceptionId', ParseUUIDPipe) exceptionId: string,
  ): Promise<AvailabilityExceptionDataResponseDto> {
    const data = await this.availabilityExceptionService.findOne(
      resourceId,
      exceptionId,
      this.getOrganizationId(req),
    );
    return { data };
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an availability exception for a resource' })
  @ApiParam({ name: 'resourceId', type: String, format: 'uuid' })
  @ApiBody({
    type: CreateAvailabilityExceptionDto,
    examples: {
      maintenance: {
        summary: 'Unavailable for maintenance',
        value: {
          exceptionDate: '2026-08-25',
          startTime: '12:00',
          endTime: '18:00',
          exceptionType: 'UNAVAILABLE',
          reason: 'Maintenance',
          metadata: {},
        },
      },
      special: {
        summary: 'Extra available window',
        value: {
          exceptionDate: '2026-08-29',
          startTime: '10:00',
          endTime: '14:00',
          exceptionType: 'AVAILABLE',
          reason: 'Special event',
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: AvailabilityExceptionDataResponseDto })
  @ApiResponse({ status: 409, description: 'Overlapping exception' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Body() dto: CreateAvailabilityExceptionDto,
  ): Promise<AvailabilityExceptionDataResponseDto> {
    const data = await this.availabilityExceptionService.create(
      resourceId,
      dto,
      this.getOrganizationId(req),
    );
    return { data };
  }

  @Patch(':exceptionId')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update an availability exception' })
  @ApiParam({ name: 'resourceId', type: String, format: 'uuid' })
  @ApiParam({ name: 'exceptionId', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateAvailabilityExceptionDto })
  @ApiResponse({ status: 200, type: AvailabilityExceptionDataResponseDto })
  @ApiResponse({ status: 409, description: 'Overlapping exception' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Param('exceptionId', ParseUUIDPipe) exceptionId: string,
    @Body() dto: UpdateAvailabilityExceptionDto,
  ): Promise<AvailabilityExceptionDataResponseDto> {
    const data = await this.availabilityExceptionService.update(
      resourceId,
      exceptionId,
      dto,
      this.getOrganizationId(req),
    );
    return { data };
  }

  @Delete(':exceptionId')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hard-delete an availability exception' })
  @ApiParam({ name: 'resourceId', type: String, format: 'uuid' })
  @ApiParam({ name: 'exceptionId', type: String, format: 'uuid' })
  @ApiResponse({ status: 204 })
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Param('exceptionId', ParseUUIDPipe) exceptionId: string,
  ): Promise<void> {
    return this.availabilityExceptionService.remove(
      resourceId,
      exceptionId,
      this.getOrganizationId(req),
    );
  }
}
