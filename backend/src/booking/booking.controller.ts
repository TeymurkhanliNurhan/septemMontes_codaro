import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  Req,
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
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingResponseDto } from './dto/booking-response.dto';

@ApiTags('Booking')
@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'List bookings' })
  @ApiQuery({ name: 'id', required: false })
  @ApiResponse({ status: 200, type: [BookingResponseDto] })
  findAll(@Req() req: AuthenticatedRequest, @Query('id') id?: string) {
    const organizationId = req.user.organizationId;
    if (id) return this.bookingService.findOne(id);
    return this.bookingService.findByOrganization(organizationId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Create booking' })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateBookingDto) {
    const organizationId = req.user.organizationId;
    const userId = req.user.userId;
    return this.bookingService.create(dto, organizationId, userId);
  }

  @Patch()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  update(@Body() dto: UpdateBookingDto) {
    return this.bookingService.update(dto);
  }

  @Delete()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiQuery({ name: 'id', required: true })
  remove(@Query('id') id: string) {
    return this.bookingService.remove(id);
  }
}
