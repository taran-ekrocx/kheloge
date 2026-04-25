import { Injectable } from '@nestjs/common';
import { Prisma } from '@kheloge/database';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getRevenue(orgId: string, from: Date, to: Date, venueId?: string) {
    const venueFilter = venueId ? Prisma.sql`AND v.id = ${venueId}` : Prisma.sql``;

    const rows = await this.prisma.$queryRaw<Array<{ period: string; total: number; count: number }>>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', p."paidAt"), 'YYYY-MM') AS period,
        COALESCE(SUM(p.amount), 0)::float                   AS total,
        COUNT(*)::int                                        AS count
      FROM payments p
      JOIN students s ON p."studentId" = s.id
      JOIN venues   v ON s."venueId"   = v.id
      WHERE v."organizationId" = ${orgId}
        AND p.status            = 'PAID'
        AND p."paidAt"         >= ${from}
        AND p."paidAt"         <= ${to}
        ${venueFilter}
      GROUP BY DATE_TRUNC('month', p."paidAt")
      ORDER BY DATE_TRUNC('month', p."paidAt") ASC
    `;
    return rows;
  }

  async getEnrolments(orgId: string, from: Date, to: Date, venueId?: string) {
    const venueFilter = venueId ? Prisma.sql`AND v.id = ${venueId}` : Prisma.sql``;

    const rows = await this.prisma.$queryRaw<Array<{ sport: string; total: number; active: number }>>`
      SELECT
        sp.name                                                         AS sport,
        COUNT(*)::int                                                   AS total,
        SUM(CASE WHEN e."isActive" THEN 1 ELSE 0 END)::int             AS active
      FROM enrollments e
      JOIN batches b ON e."batchId" = b.id
      JOIN sports  sp ON b."sportId" = sp.id
      JOIN venues  v  ON b."venueId" = v.id
      WHERE v."organizationId" = ${orgId}
        AND e."enrolledAt"    >= ${from}
        AND e."enrolledAt"    <= ${to}
        ${venueFilter}
      GROUP BY sp.name
      ORDER BY total DESC
    `;
    return rows;
  }

  async getAttendance(orgId: string, from: Date, to: Date, batchId?: string, venueId?: string) {
    const batchFilter = batchId ? Prisma.sql`AND a."batchId" = ${batchId}` : Prisma.sql``;
    const venueFilter = venueId ? Prisma.sql`AND v.id = ${venueId}` : Prisma.sql``;

    const rows = await this.prisma.$queryRaw<Array<{ status: string; count: number }>>`
      SELECT a.status, COUNT(*)::int AS count
      FROM attendances a
      JOIN batches b ON a."batchId" = b.id
      JOIN venues  v ON b."venueId" = v.id
      WHERE v."organizationId" = ${orgId}
        AND a.date >= ${from}
        AND a.date <= ${to}
        ${batchFilter}
        ${venueFilter}
      GROUP BY a.status
    `;

    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const row of rows) {
      const key = row.status as keyof typeof counts;
      if (key in counts) counts[key] = row.count;
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const presentRate = total > 0 ? (((counts.PRESENT + counts.LATE) / total) * 100).toFixed(1) : '0';

    return { ...counts, total, presentRate: parseFloat(presentRate) };
  }

  async exportCsv(
    orgId: string,
    type: 'revenue' | 'enrolments',
    from: Date,
    to: Date,
    venueId?: string,
  ): Promise<string> {
    if (type === 'revenue') {
      const rows = await this.getRevenue(orgId, from, to, venueId);
      const header = 'Period,Total Revenue (INR),Transactions\n';
      const lines = rows.map((r) => `${r.period},${r.total},${r.count}`).join('\n');
      return header + lines;
    } else {
      const rows = await this.getEnrolments(orgId, from, to, venueId);
      const header = 'Sport,Total Enrolments,Active\n';
      const lines = rows.map((r) => `${r.sport},${r.total},${r.active}`).join('\n');
      return header + lines;
    }
  }
}
