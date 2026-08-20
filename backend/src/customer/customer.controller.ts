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
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerResponseDto } from './dto/customer-response.dto';

@ApiTags('Customer')
@Controller('customers')
@ApiCookieAuth('session')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'List customers' })
  @ApiQuery({ name: 'id', required: false })
  @ApiResponse({ status: 200, type: [CustomerResponseDto] })
  findAll(@Req() req: AuthenticatedRequest, @Query('id') id?: string) {
    const organizationId = req.user.organizationId;
    if (id) return this.customerService.findOne(id);
    return this.customerService.findByOrganization(organizationId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Create customer' })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateCustomerDto) {
    const organizationId = req.user.organizationId;
    const userId = req.user.userId;
    return this.customerService.create(dto, organizationId, userId);
  }

  @Patch()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  update(@Body() dto: UpdateCustomerDto) {
    return this.customerService.update(dto);
  }

  @Delete()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiQuery({ name: 'id', required: true })
  remove(@Query('id') id: string) {
    return this.customerService.remove(id);
  }
}
