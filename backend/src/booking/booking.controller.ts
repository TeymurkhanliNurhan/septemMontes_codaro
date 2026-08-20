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
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { BookingService } from './booking.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import {
  BookingDataResponseDto,
  BookingListResponseDto,
} from './dto/booking-response.dto';

@ApiTags('Booking')
@Controller('bookings')
@ApiCookieAuth('session')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  private getOrganizationId(req: AuthenticatedRequest): string {
    return req.user.organizationId;
  }

  private getUserId(req: AuthenticatedRequest): string {
    return req.user.userId;
  }

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'List bookings for the current organization' })
  @ApiQuery({ name: 'id', required: false, type: String, format: 'uuid' })
  @ApiResponse({ status: 200, type: BookingListResponseDto })
  @ApiResponse({ status: 200, type: BookingDataResponseDto })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('id') id?: string,
  ): Promise<BookingListResponseDto | BookingDataResponseDto> {
    const organizationId = this.getOrganizationId(req);
    if (id) {
      const data = await this.bookingService.findOne(id, organizationId);
      return { data };
    }
    return this.bookingService.findByOrganization(organizationId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a booking (emits CREATED event)' })
  @ApiBody({ type: CreateBookingDto })
  @ApiResponse({ status: 201, type: BookingDataResponseDto })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateBookingDto,
  ): Promise<BookingDataResponseDto> {
    const data = await this.bookingService.create(
      dto,
      this.getOrganizationId(req),
      this.getUserId(req),
    );
    return { data };
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({
    summary: 'Update non-status booking fields (title, notes, metadata)',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateBookingDto })
  @ApiResponse({ status: 200, type: BookingDataResponseDto })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookingDto,
  ): Promise<BookingDataResponseDto> {
    const data = await this.bookingService.update(
      id,
      dto,
      this.getOrganizationId(req),
    );
    return { data };
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a booking' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 204 })
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.bookingService.remove(id, this.getOrganizationId(req));
  }

  @Post(':id/confirm')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Confirm a pending booking (emits CONFIRMED)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, type: BookingDataResponseDto })
  async confirm(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BookingDataResponseDto> {
    const data = await this.bookingService.confirm(
      id,
      this.getOrganizationId(req),
      this.getUserId(req),
    );
    return { data };
  }

  @Post(':id/cancel')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Cancel a booking (emits CANCELLED)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({ type: CancelBookingDto, required: false })
  @ApiResponse({ status: 200, type: BookingDataResponseDto })
  async cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelBookingDto,
  ): Promise<BookingDataResponseDto> {
    const data = await this.bookingService.cancel(
      id,
      this.getOrganizationId(req),
      this.getUserId(req),
      dto ?? {},
    );
    return { data };
  }

  @Post(':id/reschedule')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Reschedule a booking (emits RESCHEDULED)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({ type: RescheduleBookingDto })
  @ApiResponse({ status: 200, type: BookingDataResponseDto })
  async reschedule(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleBookingDto,
  ): Promise<BookingDataResponseDto> {
    const data = await this.bookingService.reschedule(
      id,
      this.getOrganizationId(req),
      this.getUserId(req),
      dto,
    );
    return { data };
  }

  @Post(':id/complete')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Mark booking completed (emits COMPLETED)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, type: BookingDataResponseDto })
  async complete(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BookingDataResponseDto> {
    const data = await this.bookingService.complete(
      id,
      this.getOrganizationId(req),
      this.getUserId(req),
    );
    return { data };
  }

  @Post(':id/no-show')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Mark booking as no-show (emits NO_SHOW)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, type: BookingDataResponseDto })
  async markNoShow(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BookingDataResponseDto> {
    const data = await this.bookingService.markNoShow(
      id,
      this.getOrganizationId(req),
      this.getUserId(req),
    );
    return { data };
  }
}
