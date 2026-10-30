/**
 * One-time script: list every celebrity application approved before approval
 * started creating the Celebrity row. Safe to re-run — an application whose
 * name already has a Celebrity row is skipped.
 *
 * Run: node scripts/backfill-approved-celebrities.js
 */
const { PrismaClient } = require('@prisma/client');
const { toCelebrity } = require('../src/modules/celebrity-applications/celebrityApplication.service');
const prisma = new PrismaClient();

(async () => {
  const applications = await prisma.celebrityApplication.findMany({
    where: { status: 'APPROVED' },
    select: { name: true, partnerType: true, photoKey: true, instagramAccounts: true, youtubeChannels: true },
  });

  let created = 0;
  for (const application of applications) {
    const existing = await prisma.celebrity.findFirst({ where: { name: application.name }, select: { id: true } });
    if (existing) continue;
    await prisma.celebrity.create({ data: toCelebrity(application) });
    created++;
  }

  console.log(`Created ${created} celebrity row(s) from ${applications.length} approved application(s).`);
  await prisma.$disconnect();
})();
