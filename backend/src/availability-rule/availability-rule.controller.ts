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
  Req,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { AvailabilityRuleService } from './availability-rule.service';
import { CreateAvailabilityRuleDto } from './dto/create-rule.dto';
import { UpdateAvailabilityRuleDto } from './dto/update-rule.dto';
import {
  AvailabilityRuleActiveStatusDataResponseDto,
  AvailabilityRuleDataResponseDto,
  AvailabilityRuleListResponseDto,
} from './dto/rule-response.dto';

@ApiTags('AvailabilityRule')
@Controller('resources/:resourceId/availability/rules')
@ApiCookieAuth('session')
export class AvailabilityRuleController {
  constructor(
    private readonly availabilityRuleService: AvailabilityRuleService,
  ) {}

  private getOrganizationId(req: AuthenticatedRequest): string {
    return req.user.organizationId;
  }

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({
    summary: 'List availability rules for a resource in the current organization',
  })
  @ApiParam({
    name: 'resourceId',
    type: String,
    format: 'uuid',
    description: 'Resource UUID',
  })
  @ApiResponse({ status: 200, type: AvailabilityRuleListResponseDto })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
  ): Promise<AvailabilityRuleListResponseDto> {
    return this.availabilityRuleService.findAll(
      resourceId,
      this.getOrganizationId(req),
    );
  }

  @Get(':ruleId')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Get a single availability rule' })
  @ApiParam({ name: 'resourceId', type: String, format: 'uuid' })
  @ApiParam({ name: 'ruleId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, type: AvailabilityRuleDataResponseDto })
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ): Promise<AvailabilityRuleDataResponseDto> {
    const data = await this.availabilityRuleService.findOne(
      resourceId,
      ruleId,
      this.getOrganizationId(req),
    );
    return { data };
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an availability rule for a resource' })
  @ApiParam({ name: 'resourceId', type: String, format: 'uuid' })
  @ApiBody({
    type: CreateAvailabilityRuleDto,
    examples: {
      monday: {
        summary: 'Monday 09:00–18:00',
        value: {
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '18:00',
          timezone: 'Europe/Warsaw',
          metadata: {},
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: AvailabilityRuleDataResponseDto })
  @ApiResponse({ status: 409, description: 'Overlapping active rule' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Body() dto: CreateAvailabilityRuleDto,
  ): Promise<AvailabilityRuleDataResponseDto> {
    const data = await this.availabilityRuleService.create(
      resourceId,
      dto,
      this.getOrganizationId(req),
    );
    return { data };
  }

  @Patch(':ruleId/activate')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Activate an availability rule' })
  @ApiParam({ name: 'resourceId', type: String, format: 'uuid' })
  @ApiParam({ name: 'ruleId', type: String, format: 'uuid' })
  @ApiResponse({
    status: 200,
    type: AvailabilityRuleActiveStatusDataResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Overlapping active rule' })
  async activate(
    @Req() req: AuthenticatedRequest,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ): Promise<AvailabilityRuleActiveStatusDataResponseDto> {
    const data = await this.availabilityRuleService.activate(
      resourceId,
      ruleId,
      this.getOrganizationId(req),
    );
    return { data };
  }

  @Patch(':ruleId/deactivate')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Deactivate an availability rule' })
  @ApiParam({ name: 'resourceId', type: String, format: 'uuid' })
  @ApiParam({ name: 'ruleId', type: String, format: 'uuid' })
  @ApiResponse({
    status: 200,
    type: AvailabilityRuleActiveStatusDataResponseDto,
  })
  async deactivate(
    @Req() req: AuthenticatedRequest,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ): Promise<AvailabilityRuleActiveStatusDataResponseDto> {
    const data = await this.availabilityRuleService.deactivate(
      resourceId,
      ruleId,
      this.getOrganizationId(req),
    );
    return { data };
  }

  @Patch(':ruleId')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update an availability rule' })
  @ApiParam({ name: 'resourceId', type: String, format: 'uuid' })
  @ApiParam({ name: 'ruleId', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateAvailabilityRuleDto })
  @ApiResponse({ status: 200, type: AvailabilityRuleDataResponseDto })
  @ApiResponse({ status: 409, description: 'Overlapping active rule' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: UpdateAvailabilityRuleDto,
  ): Promise<AvailabilityRuleDataResponseDto> {
    const data = await this.availabilityRuleService.update(
      resourceId,
      ruleId,
      dto,
      this.getOrganizationId(req),
    );
    return { data };
  }

  @Delete(':ruleId')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hard-delete an availability rule' })
  @ApiParam({ name: 'resourceId', type: String, format: 'uuid' })
  @ApiParam({ name: 'ruleId', type: String, format: 'uuid' })
  @ApiResponse({ status: 204 })
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ): Promise<void> {
    return this.availabilityRuleService.remove(
      resourceId,
      ruleId,
      this.getOrganizationId(req),
    );
  }
}
