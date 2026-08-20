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
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationResponseDto } from './dto/organization-response.dto';

@ApiTags('Organization')
@Controller('organizations')
@ApiCookieAuth('session')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List organizations' })
  @ApiQuery({ name: 'id', required: false })
  @ApiResponse({ status: 200, type: [OrganizationResponseDto] })
  async findAll(@Query('id') id?: string) {
    if (id) {
      return this.organizationService.findOne(id);
    }
    return this.organizationService.findAll();
  }

  @Post()
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Create organization' })
  @ApiResponse({ status: 201, type: OrganizationResponseDto })
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationService.create(dto);
  }

  @Patch()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update organization' })
  @ApiResponse({ status: 200, type: OrganizationResponseDto })
  update(@Body() dto: UpdateOrganizationDto) {
    return this.organizationService.update(dto);
  }

  @Delete()
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Delete organization' })
  @ApiQuery({ name: 'id', required: true })
  remove(@Query('id') id: string) {
    return this.organizationService.remove(id);
  }
}
