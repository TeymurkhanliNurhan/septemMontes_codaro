import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { BookingResourceService } from './booking-resource.service';
import { CreateBookingResourceDto } from './dto/create-booking-resource.dto';

@ApiTags('BookingResource')
@Controller('booking-resources')
@ApiCookieAuth('session')
export class BookingResourceController {
  constructor(private readonly service: BookingResourceService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'List booking-resources' })
  @ApiQuery({ name: 'bookingId', required: false })
  findAll(@Query('bookingId') bookingId?: string) {
    return this.service.findAll(bookingId ? { bookingId } : undefined);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  create(@Body() dto: CreateBookingResourceDto) {
    return this.service.create(dto);
  }

  @Delete()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiQuery({ name: 'bookingId', required: true })
  @ApiQuery({ name: 'resourceId', required: true })
  remove(
    @Query('bookingId') bookingId: string,
    @Query('resourceId') resourceId: string,
  ) {
    return this.service.remove(bookingId, resourceId);
  }
}
