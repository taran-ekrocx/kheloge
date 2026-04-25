import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@kheloge/database';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UsersService, InviteUserDto, UpdateUserRoleDto } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  findAll(@Request() req) {
    return this.users.findAll(req.user.orgId);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  findOne(@Request() req, @Param('id') id: string) {
    return this.users.findOne(req.user.orgId, id);
  }

  @Post('invite')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  invite(@Request() req, @Body() dto: InviteUserDto) {
    return this.users.invite(req.user.orgId, dto);
  }

  @Patch(':id/role')
  @Roles(UserRole.SUPER_ADMIN)
  updateRole(@Request() req, @Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    return this.users.updateRole(req.user.orgId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  remove(@Request() req, @Param('id') id: string) {
    return this.users.remove(req.user.orgId, id);
  }
}
