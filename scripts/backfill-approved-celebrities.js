/**
 * One-time script: list every celebrity application approved before approval
 * started creating the Celebrity row, and give existing rows the ad types
 * approved before approval copied them. Safe to re-run — an application whose
 * name already has a Celebrity row is not created again, and a row that
 * already has ad types is left alone.
 *
 * Run: node scripts/backfill-approved-celebrities.js
 */
const { PrismaClient } = require('@prisma/client');
const { toCelebrity } = require('../src/modules/celebrity-applications/celebrityApplication.service');
const prisma = new PrismaClient();

(async () => {
  const applications = await prisma.celebrityApplication.findMany({
    where: { status: 'APPROVED' },
    select: { name: true, partnerType: true, photoKey: true, instagramAccounts: true, youtubeChannels: true, brandIntegrations: true },
  });

  let created = 0;
  let updated = 0;
  for (const application of applications) {
    const existing = await prisma.celebrity.findFirst({
      where: { name: application.name },
      select: { id: true, brandIntegrations: true },
    });
    if (!existing) {
      await prisma.celebrity.create({ data: toCelebrity(application) });
      created++;
    } else if (existing.brandIntegrations.length === 0 && application.brandIntegrations.length > 0) {
      await prisma.celebrity.update({ where: { id: existing.id }, data: { brandIntegrations: application.brandIntegrations } });
      updated++;
    }
  }

  console.log(`Created ${created} and updated ${updated} celebrity row(s) from ${applications.length} approved application(s).`);
  await prisma.$disconnect();
})();
