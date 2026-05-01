import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request, Res, Req, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FastifyReply } from 'fastify';
import { MultipartRequest } from '../../common/types/multipart-request';
import { UserRole, StudentStatus } from '@kheloge/database';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { StudentsService, CreateStudentDto, EnrollStudentDto, RecordAttendanceDto } from './students.service';

@ApiTags('students')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('venues/:venueId/students')
export class StudentsController {
  constructor(private students: StudentsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.COACH)
  findAll(
    @Request() req,
    @Param('venueId') venueId: string,
    @Query('search') search?: string,
    @Query('status') status?: StudentStatus | 'all',
    @Query('sportId') sportId?: string,
    @Query('batchId') batchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const coachUserId = req.user.role === UserRole.COACH ? req.user.id : undefined;
    return this.students.findAll(venueId, { search, status, sportId, batchId, coachUserId, from, to });
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.COACH)
  findOne(@Param('id') id: string) {
    return this.students.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  create(@Param('venueId') venueId: string, @Body() dto: CreateStudentDto, @Request() req) {
    return this.students.create(venueId, req.user.orgId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  update(@Param('id') id: string, @Body() dto: Partial<CreateStudentDto>) {
    return this.students.update(id, dto);
  }

  /** PATCH /venues/:venueId/students/:id/status — transition enquiry→trial→enrolled (ACTIVE) */
  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  transitionStatus(@Param('id') id: string, @Body('status') status: StudentStatus) {
    return this.students.transitionStatus(id, status);
  }

  /** POST /venues/:venueId/students/:id/enrol — enrol in a batch (canonical spelling) */
  @Post(':id/enrol')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  enrol(@Param('id') id: string, @Body() dto: EnrollStudentDto) {
    return this.students.enroll(id, dto);
  }

  @Post(':id/enroll')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  enroll(@Param('id') id: string, @Body() dto: EnrollStudentDto) {
    return this.students.enroll(id, dto);
  }

  @Delete(':id/enroll/:batchId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  unenroll(@Param('id') id: string, @Param('batchId') batchId: string) {
    return this.students.unenroll(id, batchId);
  }

  /** GET /venues/:venueId/students/:id/attendance */
  @Get(':id/attendance')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.COACH)
  getAttendance(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.students.getAttendance(id, startDate, endDate);
  }

  /** POST /venues/:venueId/students/:id/attendance — record a single attendance entry */
  @Post(':id/attendance')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.COACH)
  recordAttendance(@Param('id') id: string, @Body() dto: RecordAttendanceDto) {
    return this.students.recordAttendance(id, dto);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  deactivate(@Param('id') id: string) {
    return this.students.deactivate(id);
  }

  @Get(':id/qr')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.COACH)
  async getQrCode(@Param('id') id: string, @Res() reply: FastifyReply) {
    const buffer = await this.students.generateQrCode(id);
    reply.header('Content-Type', 'image/png').send(buffer);
  }

  @Get(':id/id-card')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER, UserRole.COACH)
  async getIdCard(@Param('id') id: string, @Res() reply: FastifyReply) {
    const pdf = await this.students.generateIdCard(id);
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="id-card-${id}.pdf"`)
      .send(pdf);
  }

  /**
   * POST /venues/:venueId/students/:id/photo
   * Uploads a student photo to R2 and stores the URL on the student record.
   */
  @Post(':id/photo')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  @ApiConsumes('multipart/form-data')
  async uploadPhoto(@Param('id') id: string, @Req() req: MultipartRequest): Promise<{ url: string }> {
    if (!req.isMultipart()) throw new BadRequestException('Request must be multipart/form-data');
    const data = await req.file();
    if (!data) throw new BadRequestException('No file provided');
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk as Buffer);
    const buffer = Buffer.concat(chunks);
    const url = await this.students.uploadPhoto(id, buffer, data.mimetype);
    return { url };
  }

  /**
   * POST /venues/:venueId/students/:id/id-card/upload
   * Generates the student ID card PDF, uploads it to R2, stores the URL and returns it.
   */
  @Post(':id/id-card/upload')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CITY_MANAGER, UserRole.VENUE_MANAGER)
  async uploadIdCard(@Param('id') id: string): Promise<{ url: string }> {
    const url = await this.students.generateAndUploadIdCard(id);
    return { url };
  }
}
