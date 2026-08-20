import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
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
import { AvailabilityExceptionService } from './availability-exception.service';
import { CreateAvailabilityExceptionDto } from './dto/create-exception.dto';
import { UpdateAvailabilityExceptionDto } from './dto/update-exception.dto';
import { AvailabilityExceptionResponseDto } from './dto/exception-response.dto';

@ApiTags('AvailabilityException')
@Controller('availability-exceptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class AvailabilityExceptionController {
  constructor(
    private readonly availabilityExceptionService: AvailabilityExceptionService,
  ) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'List availability-exceptions' })
  @ApiQuery({ name: 'id', required: false })
  @ApiQuery({ name: 'resourceId', required: false })
  @ApiResponse({ status: 200, type: [AvailabilityExceptionResponseDto] })
  findAll(@Query('id') id?: string, @Query('resourceId') resourceId?: string) {
    if (id) return this.availabilityExceptionService.findOne(id);
    if (resourceId)
      return this.availabilityExceptionService.findByFilter(resourceId);
    return this.availabilityExceptionService.findAll();
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Create availability-exception' })
  create(@Body() dto: CreateAvailabilityExceptionDto) {
    return this.availabilityExceptionService.create(dto);
  }

  @Patch()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  update(@Body() dto: UpdateAvailabilityExceptionDto) {
    return this.availabilityExceptionService.update(dto);
  }

  @Delete()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiQuery({ name: 'id', required: true })
  remove(@Query('id') id: string) {
    return this.availabilityExceptionService.remove(id);
  }
}
