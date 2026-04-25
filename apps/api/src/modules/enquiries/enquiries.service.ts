import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EnquiryStage, LeadSource } from '@kheloge/database';

export interface CreateEnquiryDto {
  name: string;
  phone: string;
  email?: string;
  sportInterest?: string;
  ageGroup?: string;
  source?: LeadSource;
  notes?: string;
  followUpAt?: string;
}

@Injectable()
export class EnquiriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(venueId: string, stage?: EnquiryStage) {
    return this.prisma.enquiry.findMany({
      where: { venueId, ...(stage && { stage }) },
      include: { comments: { include: { author: { select: { name: true } } } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(venueId: string, dto: CreateEnquiryDto) {
    return this.prisma.enquiry.create({
      data: {
        ...dto,
        venueId,
        followUpAt: dto.followUpAt ? new Date(dto.followUpAt) : undefined,
      },
    });
  }

  async updateStage(id: string, stage: EnquiryStage) {
    const data: any = { stage };
    if (stage === EnquiryStage.CONVERTED) data.convertedAt = new Date();
    return this.prisma.enquiry.update({ where: { id }, data });
  }

  async addComment(enquiryId: string, authorId: string, body: string) {
    return this.prisma.enquiryComment.create({ data: { enquiryId, authorId, body } });
  }

  async convertToStudent(enquiryId: string, batchId: string) {
    const enquiry = await this.prisma.enquiry.findUniqueOrThrow({ where: { id: enquiryId } });
    const student = await this.prisma.student.create({
      data: {
        venueId: enquiry.venueId,
        name: enquiry.name,
        phone: enquiry.phone || undefined,
        email: enquiry.email || undefined,
        enrollments: batchId ? { create: { batchId } } : undefined,
      },
    });
    await this.prisma.enquiry.update({
      where: { id: enquiryId },
      data: { stage: EnquiryStage.CONVERTED, convertedAt: new Date(), convertedToStudentId: student.id },
    });
    return student;
  }

  async getDashboard(venueId: string) {
    const enquiries = await this.prisma.enquiry.groupBy({
      by: ['stage'],
      where: { venueId },
      _count: true,
    });
    return enquiries.reduce((acc, e) => ({ ...acc, [e.stage]: e._count }), {});
  }
}
