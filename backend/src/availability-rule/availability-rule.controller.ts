import {
  Body,
  Controller,
  Delete,
  Get,
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
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AvailabilityRuleService } from './availability-rule.service';
import { CreateAvailabilityRuleDto } from './dto/create-rule.dto';
import { UpdateAvailabilityRuleDto } from './dto/update-rule.dto';
import { AvailabilityRuleResponseDto } from './dto/rule-response.dto';

@ApiTags('AvailabilityRule')
@Controller('availability-rules')
@ApiCookieAuth('session')
export class AvailabilityRuleController {
  constructor(
    private readonly availabilityRuleService: AvailabilityRuleService,
  ) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'List availability-rules' })
  @ApiQuery({ name: 'id', required: false })
  @ApiQuery({ name: 'resourceId', required: false })
  @ApiResponse({ status: 200, type: [AvailabilityRuleResponseDto] })
  findAll(@Query('id') id?: string, @Query('resourceId') resourceId?: string) {
    if (id) return this.availabilityRuleService.findOne(id);
    if (resourceId)
      return this.availabilityRuleService.findByFilter(resourceId);
    return this.availabilityRuleService.findAll();
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Create availability-rule' })
  create(@Body() dto: CreateAvailabilityRuleDto) {
    return this.availabilityRuleService.create(dto);
  }

  @Patch()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  update(@Body() dto: UpdateAvailabilityRuleDto) {
    return this.availabilityRuleService.update(dto);
  }

  @Delete()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiQuery({ name: 'id', required: true })
  remove(@Query('id') id: string) {
    return this.availabilityRuleService.remove(id);
  }
}
