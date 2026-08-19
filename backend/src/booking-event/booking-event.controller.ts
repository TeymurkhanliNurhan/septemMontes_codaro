import { Body, Controller, Delete, Get, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { BookingEventService } from './booking-event.service';
import { CreateBookingEventDto } from './dto/create-event.dto';
import { UpdateBookingEventDto } from './dto/update-event.dto';
import { BookingEventResponseDto } from './dto/event-response.dto';

@ApiTags('BookingEvent')
@Controller('booking-events')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class BookingEventController {
  constructor(private readonly bookingEventService: BookingEventService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'List booking-events' })
  @ApiQuery({ name: 'id', required: false })
  @ApiQuery({ name: 'bookingId', required: false })
  @ApiResponse({ status: 200, type: [BookingEventResponseDto] })
  findAll(@Req() req: any, @Query('id') id?: string) {
    if (id) return this.bookingEventService.findOne(id);
    const filterValue = req.query['bookingId'] as string | undefined;
    if (filterValue) return this.bookingEventService.findByFilter(filterValue);
    return this.bookingEventService.findAll();
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Create booking-event' })
  create(@Req() req: any, @Body() dto: CreateBookingEventDto) {
    return this.bookingEventService.create(dto);
  }

  @Patch()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  update(@Body() dto: UpdateBookingEventDto) {
    return this.bookingEventService.update(dto);
  }

  @Delete()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiQuery({ name: 'id', required: true })
  remove(@Query('id') id: string) {
    return this.bookingEventService.remove(id);
  }
}
