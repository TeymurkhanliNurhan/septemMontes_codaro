import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Repository } from 'typeorm';
import { Public } from '../auth/decorators/public.decorator';
import { ResourceSelectionMode } from '../common/enums/resource-selection-mode.enum';
import { Organization } from '../organization/entities/organization.entity';
import { Resource } from '../resource/entities/resource.entity';
import { Service } from '../service/entities/service.entity';
import { AvailabilityService } from './availability/availability.service';
import { eachLocalDate } from './availability/time-zone';
import { MergedSlot } from './availability/slot-math';
import { PublicBookingService } from './booking/public-booking.service';
import { CreatePublicBookingDto } from './dto/create-public-booking.dto';
import { PublicBookingResponseDto } from './dto/public-booking-response.dto';
import { PublicOrganizationDto } from './dto/public-organization.dto';
import { PublicResourceDto } from './dto/public-resource.dto';
import { PublicServiceDto } from './dto/public-service.dto';
import { PublicSlotDto } from './dto/public-slot.dto';
import { SlotQueryDto } from './dto/slot-query.dto';
import {
  MAX_SLOT_RANGE_DAYS,
  PUBLIC_BOOKING_RATE_LIMIT,
} from './public-booking.constants';

/**
 * The only unauthenticated business routes in the API. Every handler carries
 * `@Public()` explicitly — nothing here should ever rely on a route simply
 * falling outside the guard's usual reach.
 *
 * Reads never return an entity (see `toDto` helpers below): the staff API can
 * afford to hand out `metadata` and other internal columns because it sits
 * behind `SessionAuthGuard`, but this surface is open to the internet.
 */
@Public()
@ApiTags('Public booking')
@Controller('public')
export class PublicBookingController {
  constructor(
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @InjectRepository(Service)
    private readonly services: Repository<Service>,
    private readonly availability: AvailabilityService,
    private readonly bookings: PublicBookingService,
  ) {}

  @Get('orgs/:slug')
  @ApiOperation({ summary: 'Look up an organization by its public slug' })
  @ApiResponse({ status: HttpStatus.OK, type: PublicOrganizationDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Unknown organization slug',
  })
  async getOrganization(
    @Param('slug') slug: string,
  ): Promise<PublicOrganizationDto> {
    const organization = await this.findOrganization(slug);
    return this.toOrganizationDto(organization);
  }

  @Get('orgs/:slug/services')
  @ApiOperation({ summary: 'List bookable services for an organization' })
  @ApiResponse({ status: HttpStatus.OK, type: [PublicServiceDto] })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Unknown organization slug',
  })
  async listServices(@Param('slug') slug: string): Promise<PublicServiceDto[]> {
    const organization = await this.findOrganization(slug);
    const services = await this.services.find({
      where: { organizationId: organization.id, isActive: true },
      order: { name: 'ASC' },
    });
    return services.map((service) => this.toServiceDto(service));
  }

  @Get('orgs/:slug/services/:serviceId/resources')
  @ApiOperation({
    summary: 'List resources a guest may choose for a CUSTOMER_CHOICE service',
  })
  @ApiParam({ name: 'serviceId', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, type: [PublicResourceDto] })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Unknown service, or the service does not offer a choice',
  })
  async listResources(
    @Param('slug') slug: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ): Promise<PublicResourceDto[]> {
    const organization = await this.findOrganization(slug);
    const service = await this.findService(organization.id, serviceId);

    // An AUTO service must never leak staff/resource names to an anonymous
    // caller — the assignment is the system's decision, not the guest's.
    if (
      service.resourceSelectionMode !== ResourceSelectionMode.CUSTOMER_CHOICE
    ) {
      throw new NotFoundException('Service not found');
    }

    // capableResources scopes by organization id in its where clause, so the
    // org resolved from the slug is passed straight through — a resource
    // linked to this service from another organization is never fetched.
    const resources = await this.availability.capableResources(
      service.id,
      organization.id,
    );

    return resources.map((resource) => this.toResourceDto(resource));
  }

  @Get('orgs/:slug/services/:serviceId/slots')
  @ApiOperation({ summary: 'Find bookable slots for a service' })
  @ApiParam({ name: 'serviceId', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, type: [PublicSlotDto] })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Date range must cover 1 to 31 days',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Unknown organization slug or service',
  })
  async listSlots(
    @Param('slug') slug: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Query() query: SlotQueryDto,
  ): Promise<PublicSlotDto[]> {
    // The range cap is the only thing standing between an anonymous request
    // and a very large loop, so it is checked before any DB work happens.
    const dates = eachLocalDate(query.from, query.to);
    if (dates.length === 0 || dates.length > MAX_SLOT_RANGE_DAYS) {
      throw new BadRequestException(
        `Date range must cover 1 to ${MAX_SLOT_RANGE_DAYS} days`,
      );
    }

    const organization = await this.findOrganization(slug);
    const service = await this.findService(organization.id, serviceId);

    const slots = await this.availability.findSlots({
      service,
      organizationId: organization.id,
      organizationTimezone: organization.timezone,
      from: query.from,
      to: query.to,
      resourceId: query.resourceId,
      now: Date.now(),
    });

    return slots.map((slot) => this.toSlotDto(slot));
  }

  @Post('orgs/:slug/bookings')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ publicWrite: PUBLIC_BOOKING_RATE_LIMIT })
  @ApiOperation({ summary: 'Book a slot as a guest' })
  @ApiResponse({ status: HttpStatus.CREATED, type: PublicBookingResponseDto })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failure, or an unparseable startsAt',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description:
      'Unknown organization slug, unknown/inactive/unbookable service, or bad resourceId',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Slot already taken',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded',
  })
  create(
    @Param('slug') slug: string,
    @Body() dto: CreatePublicBookingDto,
  ): Promise<PublicBookingResponseDto> {
    return this.bookings.create(slug, dto);
  }

  private async findOrganization(slug: string): Promise<Organization> {
    const organization = await this.organizations.findOne({ where: { slug } });
    if (!organization) throw new NotFoundException('Organization not found');
    return organization;
  }

  private async findService(
    organizationId: string,
    serviceId: string,
  ): Promise<Service> {
    const service = await this.services.findOne({
      where: { id: serviceId, organizationId },
    });
    if (!service || !service.isActive) {
      throw new NotFoundException('Service not found');
    }
    return service;
  }

  private toOrganizationDto(organization: Organization): PublicOrganizationDto {
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      timezone: organization.timezone,
    };
  }

  private toServiceDto(service: Service): PublicServiceDto {
    return {
      id: service.id,
      name: service.name,
      description: service.description,
      durationMinutes: service.durationMinutes,
      resourceSelectionMode: service.resourceSelectionMode,
    };
  }

  private toResourceDto(resource: Resource): PublicResourceDto {
    return {
      id: resource.id,
      name: resource.name,
      resourceType: resource.resourceType,
    };
  }

  private toSlotDto(slot: MergedSlot): PublicSlotDto {
    return {
      startsAt: new Date(slot.start).toISOString(),
      endsAt: new Date(slot.end).toISOString(),
      resourceIds: slot.resourceIds,
    };
  }
}
