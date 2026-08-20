import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { BookingEventService } from './booking-event.service';
import {
  BookingEventDataResponseDto,
  BookingEventListResponseDto,
} from './dto/event-response.dto';

/**
 * Read-only booking history. Events are created by Booking domain actions,
 * not via a public create/update/delete API.
 */
@ApiTags('BookingEvent')
@Controller('bookings/:bookingId/events')
@ApiCookieAuth('session')
export class BookingEventController {
  constructor(private readonly bookingEventService: BookingEventService) {}

  private getOrganizationId(req: AuthenticatedRequest): string {
    return req.user.organizationId;
  }

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({
    summary: 'List booking history events (append-only audit timeline)',
  })
  @ApiParam({ name: 'bookingId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, type: BookingEventListResponseDto })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ): Promise<BookingEventListResponseDto> {
    return this.bookingEventService.findByBooking(
      bookingId,
      this.getOrganizationId(req),
    );
  }

  @Get(':eventId')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Get a single booking event' })
  @ApiParam({ name: 'bookingId', type: String, format: 'uuid' })
  @ApiParam({ name: 'eventId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, type: BookingEventDataResponseDto })
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<BookingEventDataResponseDto> {
    const data = await this.bookingEventService.findOne(
      bookingId,
      eventId,
      this.getOrganizationId(req),
    );
    return { data };
  }
}
