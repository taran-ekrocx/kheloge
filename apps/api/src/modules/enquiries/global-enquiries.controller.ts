import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole, EnquiryStage } from '@kheloge/database';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { EnquiriesService } from './enquiries.service';

@ApiTags('enquiries')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('enquiries')
export class GlobalEnquiriesController {
  constructor(private enquiries: EnquiriesService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  findAll(@Request() req, @Query('stage') stage?: EnquiryStage) {
    return this.enquiries.findAllForOrg(req.user.orgId, stage);
  }
}
