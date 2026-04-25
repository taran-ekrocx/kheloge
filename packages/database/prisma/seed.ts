import { PrismaClient, UserRole, AttendanceStatus, PaymentMode, PaymentStatus, FeeFrequency, BatchDay, EnquiryStage, LeadSource, StudentStatus } from '@prisma/client';

const prisma = new PrismaClient();

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function dateFromToday(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

const SPORTS = ['Cricket', 'Football', 'Badminton', 'Kabaddi', 'Swimming'];
const SPORT_ICONS = ['🏏', '⚽', '🏸', '🤼', '🏊'];

const VENUE_DATA = [
  { name: 'Andheri Sports Hub', slug: 'andheri-sports-hub', address: 'Andheri West, Mumbai', phone: '+919876543210', city: 'Mumbai' },
  { name: 'Powai Academy', slug: 'powai-academy', address: 'Hiranandani Gardens, Powai, Mumbai', phone: '+919876543211', city: 'Mumbai' },
  { name: 'CP Arena', slug: 'cp-arena', address: 'Connaught Place, New Delhi', phone: '+919876543212', city: 'Delhi' },
  { name: 'Koramangala Sports Centre', slug: 'koramangala-sports-centre', address: 'Koramangala, Bengaluru', phone: '+919876543213', city: 'Bengaluru' },
];

const COACH_DATA = [
  { name: 'Rajesh Nair', phone: '+919811000001', email: 'rajesh.nair@kheloge.demo' },
  { name: 'Sunita Rao', phone: '+919811000002', email: 'sunita.rao@kheloge.demo' },
  { name: 'Amit Desai', phone: '+919811000003', email: 'amit.desai@kheloge.demo' },
  { name: 'Priti Menon', phone: '+919811000004', email: 'priti.menon@kheloge.demo' },
];

const STUDENT_NAMES = [
  'Arjun Sharma', 'Priya Patel', 'Rohan Mehta', 'Ananya Gupta', 'Vikram Singh',
  'Neha Joshi', 'Rahul Verma', 'Sneha Reddy', 'Aditya Kumar', 'Pooja Nair',
  'Karan Malhotra', 'Divya Iyer', 'Siddharth Rao', 'Meera Pillai', 'Aarav Shah',
  'Ishaan Chaudhary', 'Riya Bhatt', 'Dev Saxena', 'Tanvi Mishra', 'Nikhil Jain',
];

const GUARDIAN_RELATIONS = ['Father', 'Mother', 'Guardian'];
const BATCH_NAMES = ['Morning Batch', 'Afternoon Batch', 'Evening Batch', 'Weekend Batch', 'Advance Batch'];

const BATCH_DAYS_BY_NAME: Record<string, BatchDay[]> = {
  'Morning Batch': [BatchDay.MONDAY, BatchDay.WEDNESDAY, BatchDay.FRIDAY],
  'Afternoon Batch': [BatchDay.TUESDAY, BatchDay.THURSDAY, BatchDay.SATURDAY],
  'Evening Batch': [BatchDay.MONDAY, BatchDay.TUESDAY, BatchDay.WEDNESDAY, BatchDay.THURSDAY, BatchDay.FRIDAY],
  'Weekend Batch': [BatchDay.SATURDAY, BatchDay.SUNDAY],
  'Advance Batch': [BatchDay.MONDAY, BatchDay.WEDNESDAY, BatchDay.FRIDAY, BatchDay.SATURDAY],
};

const BATCH_TIMES: Record<string, { startTime: string; endTime: string }> = {
  'Morning Batch': { startTime: '07:00', endTime: '09:00' },
  'Afternoon Batch': { startTime: '14:00', endTime: '16:00' },
  'Evening Batch': { startTime: '18:00', endTime: '20:00' },
  'Weekend Batch': { startTime: '09:00', endTime: '11:00' },
  'Advance Batch': { startTime: '06:00', endTime: '08:00' },
};

async function main() {
  console.log('🌱 Seeding Kheloge demo data...');

  // ── Organization ────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: 'demo' },
    create: {
      name: 'Kheloge Demo Academy',
      slug: 'demo',
      phone: '+919000000000',
      email: 'admin@kheloge.demo',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'IN',
    },
    update: {},
  });
  console.log(`✅ Organization: ${org.name}`);

  // ── Super Admin User ─────────────────────────────────────
  const adminUser = await prisma.user.upsert({
    where: { phone: '+919000000000' },
    create: { name: 'Admin', phone: '+919000000000', email: 'admin@kheloge.demo' },
    update: {},
  });
  const existingAdminOrgUser = await prisma.organizationUser.findFirst({
    where: { userId: adminUser.id, organizationId: org.id, role: UserRole.SUPER_ADMIN, venueId: null },
  });
  if (!existingAdminOrgUser) {
    await prisma.organizationUser.create({
      data: { userId: adminUser.id, organizationId: org.id, role: UserRole.SUPER_ADMIN },
    });
  }
  console.log(`✅ Super Admin: +919000000000`);

  // ── Cities ───────────────────────────────────────────────
  const cityMumbai = await prisma.city.upsert({
    where: { id: 'city_mumbai' },
    create: { id: 'city_mumbai', organizationId: org.id, name: 'Mumbai', state: 'Maharashtra' },
    update: {},
  });
  const cityDelhi = await prisma.city.upsert({
    where: { id: 'city_delhi' },
    create: { id: 'city_delhi', organizationId: org.id, name: 'Delhi', state: 'Delhi' },
    update: {},
  });
  const cityBengaluru = await prisma.city.upsert({
    where: { id: 'city_bengaluru' },
    create: { id: 'city_bengaluru', organizationId: org.id, name: 'Bengaluru', state: 'Karnataka' },
    update: {},
  });
  console.log('✅ Cities: Mumbai, Delhi, Bengaluru');

  // ── Coaches ──────────────────────────────────────────────
  const coaches = [];
  for (const cd of COACH_DATA) {
    const user = await prisma.user.upsert({
      where: { phone: cd.phone },
      create: { name: cd.name, phone: cd.phone, email: cd.email },
      update: {},
    });
    coaches.push(user);
  }
  console.log(`✅ Coaches: ${coaches.map((c) => c.name).join(', ')}`);

  // ── Sports ───────────────────────────────────────────────
  const sports = await Promise.all(
    SPORTS.map((name, i) =>
      prisma.sport.upsert({
        where: { organizationId_name: { organizationId: org.id, name } },
        create: { organizationId: org.id, name, icon: SPORT_ICONS[i] },
        update: {},
      }),
    ),
  );
  console.log(`✅ Sports: ${sports.map((s) => s.name).join(', ')}`);

  // ── Venues ───────────────────────────────────────────────
  const venues = [];
  for (const vd of VENUE_DATA) {
    const cityId = vd.city === 'Mumbai' ? cityMumbai.id : vd.city === 'Delhi' ? cityDelhi.id : cityBengaluru.id;
    const venue = await prisma.venue.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug: vd.slug } },
      create: {
        organizationId: org.id,
        cityId,
        name: vd.name,
        slug: vd.slug,
        address: vd.address,
        phone: vd.phone,
        openTime: '06:00',
        closeTime: '22:00',
      },
      update: {},
    });

    // Link all sports to venue
    for (const sport of sports) {
      await prisma.venueSport.upsert({
        where: { venueId_sportId: { venueId: venue.id, sportId: sport.id } },
        create: { venueId: venue.id, sportId: sport.id },
        update: {},
      });
    }
    venues.push(venue);
  }
  console.log(`✅ Venues: ${venues.map((v) => v.name).join(', ')}`);

  // ── Register coaches as OrganizationUsers ─────────────────
  for (let ci = 0; ci < coaches.length; ci++) {
    const venueForCoach = venues[ci % venues.length];
    await prisma.organizationUser.upsert({
      where: {
        userId_organizationId_venueId_role: {
          userId: coaches[ci].id,
          organizationId: org.id,
          venueId: venueForCoach.id,
          role: UserRole.COACH,
        },
      },
      create: {
        userId: coaches[ci].id,
        organizationId: org.id,
        venueId: venueForCoach.id,
        role: UserRole.COACH,
      },
      update: {},
    });
  }

  // ── Batches ──────────────────────────────────────────────
  const allBatches: { batch: any; venueId: string; sportId: string }[] = [];

  for (const venue of venues) {
    for (const sport of sports) {
      for (const batchName of BATCH_NAMES) {
        const times = BATCH_TIMES[batchName];
        const days = BATCH_DAYS_BY_NAME[batchName];
        const existing = await prisma.batch.findFirst({
          where: { venueId: venue.id, sportId: sport.id, name: batchName },
        });
        if (!existing) {
          const batch = await prisma.batch.create({
            data: {
              venueId: venue.id,
              sportId: sport.id,
              name: batchName,
              capacity: 20,
              startTime: times.startTime,
              endTime: times.endTime,
              days,
              startDate: daysAgo(90),
            },
          });
          allBatches.push({ batch, venueId: venue.id, sportId: sport.id });
        } else {
          allBatches.push({ batch: existing, venueId: venue.id, sportId: sport.id });
        }
      }
    }
  }
  console.log(`✅ Batches: ${allBatches.length} created`);

  // ── Assign coaches to batches ─────────────────────────────
  for (let bi = 0; bi < allBatches.length; bi++) {
    const coach = coaches[bi % coaches.length];
    await prisma.batchCoach.upsert({
      where: { batchId_coachId: { batchId: allBatches[bi].batch.id, coachId: coach.id } },
      create: { batchId: allBatches[bi].batch.id, coachId: coach.id, isPrimary: true },
      update: {},
    });
  }
  console.log(`✅ BatchCoaches: coaches assigned to batches`);

  // ── Students (20 per venue) ───────────────────────────────
  let totalStudents = 0;

  for (const venue of venues) {
    const venueBatches = allBatches.filter((b) => b.venueId === venue.id);

    for (let i = 0; i < 20; i++) {
      const name = STUDENT_NAMES[i] + (venues.indexOf(venue) > 0 ? ` (${venue.name.split(' ')[0]})` : '');
      const phone = `+91${randomBetween(7000000000, 9999999999)}`;
      const dob = new Date(randomBetween(2005, 2015), randomBetween(0, 11), randomBetween(1, 28));

      const existingStudent = await prisma.student.findFirst({ where: { venueId: venue.id, phone } });
      if (existingStudent) continue;

      const student = await prisma.student.create({
        data: {
          venueId: venue.id,
          name,
          phone,
          email: `${name.toLowerCase().replace(/ /g, '.')}.${i}@demo.com`,
          dob,
          status: StudentStatus.ACTIVE,
          guardians: {
            create: [
              {
                name: `Parent of ${name.split(' ')[0]}`,
                phone: `+91${randomBetween(7000000000, 9999999999)}`,
                relation: GUARDIAN_RELATIONS[randomBetween(0, 1)],
                isPrimary: true,
              },
            ],
          },
        },
      });

      // Enroll in 1-2 batches per venue
      const studentBatches = venueBatches
        .filter((b) => b.sportId === sports[i % sports.length].id)
        .slice(0, 2);

      for (const { batch } of studentBatches) {
        await prisma.enrollment.upsert({
          where: { studentId_batchId: { studentId: student.id, batchId: batch.id } },
          create: { studentId: student.id, batchId: batch.id, enrolledAt: daysAgo(80) },
          update: {},
        });

        // ── Attendance: 3 months history ──────────────────────
        for (let daysBack = 90; daysBack >= 1; daysBack -= 3) {
          const date = daysAgo(daysBack);
          date.setHours(0, 0, 0, 0);
          const status = Math.random() > 0.25 ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT;
          await prisma.attendance.upsert({
            where: { batchId_studentId_date: { batchId: batch.id, studentId: student.id, date } },
            create: { batchId: batch.id, studentId: student.id, date, status },
            update: {},
          });
        }
      }

      // ── Fee Plan & Invoice ─────────────────────────────────
      if (venueBatches.length > 0) {
        const feePlan = await prisma.feePlan.create({
          data: {
            batchId: venueBatches[0].batch.id,
            name: 'Monthly Fee',
            amount: randomBetween(1500, 3000),
            frequency: FeeFrequency.MONTHLY,
            dueDay: 1,
          },
        });

        const invoiceNumber = `INV-${venue.id.slice(-4)}-${student.id.slice(-4)}-${Date.now()}`;
        const invoice = await prisma.invoice.create({
          data: {
            studentId: student.id,
            feePlanId: feePlan.id,
            amount: feePlan.amount,
            dueDate: dateFromToday(5),
            invoiceNumber,
            status: PaymentStatus.PENDING,
          },
        });

        // 60% of students have paid
        if (Math.random() > 0.4) {
          const receiptNumber = `RCP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
          await prisma.payment.create({
            data: {
              studentId: student.id,
              invoiceId: invoice.id,
              amount: feePlan.amount,
              mode: Math.random() > 0.5 ? PaymentMode.UPI : PaymentMode.CASH,
              receiptNumber,
              paidAt: daysAgo(randomBetween(1, 30)),
              status: PaymentStatus.PAID,
            },
          });
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { status: PaymentStatus.PAID },
          });
        }
      }

      totalStudents++;
    }

    // ── Enquiries (pipeline) ──────────────────────────────────
    const stages = Object.values(EnquiryStage);
    for (let eq = 0; eq < 8; eq++) {
      await prisma.enquiry.create({
        data: {
          venueId: venue.id,
          name: `Prospect ${eq + 1} (${venue.name.split(' ')[0]})`,
          phone: `+91${randomBetween(7000000000, 9999999999)}`,
          sportInterest: sports[eq % sports.length].name,
          stage: stages[eq % stages.length],
          source: [LeadSource.WHATSAPP, LeadSource.INSTAGRAM, LeadSource.WALK_IN][eq % 3],
          followUpAt: dateFromToday(randomBetween(1, 7)),
        },
      });
    }
  }

  console.log(`✅ Students: ${totalStudents} seeded with attendance, invoices, payments`);
  console.log(`✅ Enquiries: ${venues.length * 8} pipeline entries seeded`);
  console.log('\n🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
