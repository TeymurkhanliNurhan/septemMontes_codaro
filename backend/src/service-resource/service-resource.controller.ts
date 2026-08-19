import { Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { ServiceResourceService } from './service-resource.service';
import { CreateServiceResourceDto } from './dto/create-service-resource.dto';

@ApiTags('ServiceResource')
@Controller('service-resources')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class ServiceResourceController {
  constructor(private readonly service: ServiceResourceService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'List service-resources' })
  @ApiQuery({ name: 'serviceId', required: false })
  findAll(@Query('serviceId') serviceId?: string) {
    return this.service.findAll(serviceId ? { serviceId } : undefined);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  create(@Body() dto: CreateServiceResourceDto) {
    return this.service.create(dto);
  }

  @Delete()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiQuery({ name: 'serviceId', required: true })
  @ApiQuery({ name: 'resourceId', required: true })
  remove(@Query('serviceId') serviceId: string, @Query('resourceId') resourceId: string) {
    return this.service.remove(serviceId, resourceId);
  }
}
