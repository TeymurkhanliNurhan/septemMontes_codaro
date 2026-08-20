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
import { BookingParticipantService } from './booking-participant.service';
import { CreateBookingParticipantDto } from './dto/create-participant.dto';
import { UpdateBookingParticipantDto } from './dto/update-participant.dto';
import { BookingParticipantResponseDto } from './dto/participant-response.dto';

@ApiTags('BookingParticipant')
@Controller('booking-participants')
@ApiCookieAuth('session')
export class BookingParticipantController {
  constructor(
    private readonly bookingParticipantService: BookingParticipantService,
  ) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'List booking-participants' })
  @ApiQuery({ name: 'id', required: false })
  @ApiQuery({ name: 'bookingId', required: false })
  @ApiResponse({ status: 200, type: [BookingParticipantResponseDto] })
  findAll(@Query('id') id?: string, @Query('bookingId') bookingId?: string) {
    if (id) return this.bookingParticipantService.findOne(id);
    if (bookingId)
      return this.bookingParticipantService.findByFilter(bookingId);
    return this.bookingParticipantService.findAll();
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Create booking-participant' })
  create(@Body() dto: CreateBookingParticipantDto) {
    return this.bookingParticipantService.create(dto);
  }

  @Patch()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  update(@Body() dto: UpdateBookingParticipantDto) {
    return this.bookingParticipantService.update(dto);
  }

  @Delete()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiQuery({ name: 'id', required: true })
  remove(@Query('id') id: string) {
    return this.bookingParticipantService.remove(id);
  }
}
