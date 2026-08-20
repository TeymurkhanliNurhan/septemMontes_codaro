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
import { ServiceService } from './service.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServiceResponseDto } from './dto/service-response.dto';

@ApiTags('Service')
@Controller('services')
@ApiCookieAuth('session')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'List services' })
  @ApiQuery({ name: 'id', required: false })
  @ApiResponse({ status: 200, type: [ServiceResponseDto] })
  findAll(@Req() req: AuthenticatedRequest, @Query('id') id?: string) {
    const organizationId = req.user.organizationId;
    if (id) return this.serviceService.findOne(id);
    return this.serviceService.findByOrganization(organizationId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Create service' })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateServiceDto) {
    const organizationId = req.user.organizationId;
    const userId = req.user.userId;
    return this.serviceService.create(dto, organizationId, userId);
  }

  @Patch()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  update(@Body() dto: UpdateServiceDto) {
    return this.serviceService.update(dto);
  }

  @Delete()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiQuery({ name: 'id', required: true })
  remove(@Query('id') id: string) {
    return this.serviceService.remove(id);
  }
}
