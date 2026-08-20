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
import { BookingEventService } from './booking-event.service';
import { CreateBookingEventDto } from './dto/create-event.dto';
import { UpdateBookingEventDto } from './dto/update-event.dto';
import { BookingEventResponseDto } from './dto/event-response.dto';

@ApiTags('BookingEvent')
@Controller('booking-events')
@ApiCookieAuth('session')
export class BookingEventController {
  constructor(private readonly bookingEventService: BookingEventService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'List booking-events' })
  @ApiQuery({ name: 'id', required: false })
  @ApiQuery({ name: 'bookingId', required: false })
  @ApiResponse({ status: 200, type: [BookingEventResponseDto] })
  findAll(@Query('id') id?: string, @Query('bookingId') bookingId?: string) {
    if (id) return this.bookingEventService.findOne(id);
    if (bookingId) return this.bookingEventService.findByFilter(bookingId);
    return this.bookingEventService.findAll();
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Create booking-event' })
  create(@Body() dto: CreateBookingEventDto) {
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
