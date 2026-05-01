/**
 * Database cleanup script for Kheloge demo data.
 *
 * Run with: npx ts-node prisma/cleanup.ts
 *
 * What this does:
 *   TRUNCATE all rows from: attendances, attendance_sessions, fee_plans, invoices, payments
 *   KEEP ONE record in:      students, batches, coaches (org_users with COACH role)
 *   LEAVE UNCHANGED:         venues, cities, sports, organizations (and their join tables)
 *
 * Deletion order respects FK constraints.
 */

import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Starting database cleanup...\n');

  // ── Step 1: Clear transactional / dependent tables first ──────────────────

  const delPayments = await prisma.payment.deleteMany({});
  console.log(`✅ Deleted ${delPayments.count} payments`);

  const delInvoices = await prisma.invoice.deleteMany({});
  console.log(`✅ Deleted ${delInvoices.count} invoices`);

  const delFeePlans = await prisma.feePlan.deleteMany({});
  console.log(`✅ Deleted ${delFeePlans.count} fee plans`);

  const delAttendances = await prisma.attendance.deleteMany({});
  console.log(`✅ Deleted ${delAttendances.count} attendance records`);

  const delSessions = await prisma.attendanceSession.deleteMany({});
  console.log(`✅ Deleted ${delSessions.count} attendance sessions`);

  // ── Step 2: Keep ONE student ──────────────────────────────────────────────

  const allStudents = await prisma.student.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  if (allStudents.length > 1) {
    const idsToDelete = allStudents.slice(1).map((s) => s.id);
    // guardians, enrollments, payments, invoices all have onDelete: Cascade
    const delStudents = await prisma.student.deleteMany({
      where: { id: { in: idsToDelete } },
    });
    console.log(`✅ Deleted ${delStudents.count} students (kept 1: ${allStudents[0].id})`);
  } else {
    console.log(`✅ Students: ${allStudents.length} already (no cleanup needed)`);
  }

  // ── Step 3: Keep ONE batch ────────────────────────────────────────────────

  const allBatches = await prisma.batch.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  if (allBatches.length > 1) {
    const batchIdsToDelete = allBatches.slice(1).map((b) => b.id);

    // enrollments for batches being deleted — cascade handles this but be explicit
    // (the kept student's enrollment in other batches will also be removed)
    await prisma.enrollment.deleteMany({ where: { batchId: { in: batchIdsToDelete } } });

    // batch_coaches cascade on batch delete, but let's be explicit
    await prisma.batchCoach.deleteMany({ where: { batchId: { in: batchIdsToDelete } } });

    const delBatches = await prisma.batch.deleteMany({
      where: { id: { in: batchIdsToDelete } },
    });
    console.log(`✅ Deleted ${delBatches.count} batches (kept 1: ${allBatches[0].id})`);
  } else {
    console.log(`✅ Batches: ${allBatches.length} already (no cleanup needed)`);
  }

  // ── Step 4: Keep ONE coach (org_user with COACH role) ────────────────────

  const allCoachOrgUsers = await prisma.organizationUser.findMany({
    where: { role: UserRole.COACH },
    orderBy: { createdAt: 'asc' },
    select: { id: true, userId: true },
  });

  if (allCoachOrgUsers.length > 1) {
    const coachesToDelete = allCoachOrgUsers.slice(1);
    const userIdsToDelete = coachesToDelete.map((c) => c.userId);

    // Remove coach-sports assignments for deleted coaches
    await prisma.coachSport.deleteMany({ where: { coachId: { in: userIdsToDelete } } });

    // Remove batch-coach assignments for deleted coaches (may remain after batch cleanup)
    await prisma.batchCoach.deleteMany({ where: { coachId: { in: userIdsToDelete } } });

    // Remove org-user entries with COACH role for deleted coaches
    const orgUserIdsToDelete = coachesToDelete.map((c) => c.id);
    const delCoachOrgUsers = await prisma.organizationUser.deleteMany({
      where: { id: { in: orgUserIdsToDelete } },
    });
    console.log(
      `✅ Deleted ${delCoachOrgUsers.count} coach org-memberships (kept 1 coach: userId ${allCoachOrgUsers[0].userId})`,
    );
  } else {
    console.log(`✅ Coaches: ${allCoachOrgUsers.length} already (no cleanup needed)`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  const [studentCount, batchCount, coachCount, attendanceCount, paymentCount, invoiceCount, feePlanCount] =
    await Promise.all([
      prisma.student.count(),
      prisma.batch.count(),
      prisma.organizationUser.count({ where: { role: UserRole.COACH } }),
      prisma.attendance.count(),
      prisma.payment.count(),
      prisma.invoice.count(),
      prisma.feePlan.count(),
    ]);

  console.log('\n📊 Final counts:');
  console.log(`  students:          ${studentCount}`);
  console.log(`  batches:           ${batchCount}`);
  console.log(`  coaches (org):     ${coachCount}`);
  console.log(`  attendances:       ${attendanceCount}`);
  console.log(`  payments:          ${paymentCount}`);
  console.log(`  invoices:          ${invoiceCount}`);
  console.log(`  fee_plans:         ${feePlanCount}`);

  console.log('\n✅ Cleanup complete!');
}

main()
  .catch((e) => {
    console.error('Cleanup error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
