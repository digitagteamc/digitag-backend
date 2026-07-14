/**
 * One-time script: generate the admin-only DigiTag (UserTag row) for every
 * existing creator/freelancer profile that predates this feature.
 * Safe to re-run — ensureUserTag no-ops for a user+role that already has one.
 *
 * Run: node scripts/backfill-user-tags.js
 */
const { PrismaClient } = require('@prisma/client');
const { ensureUserTag } = require('../src/utils/generateUserTag');
const prisma = new PrismaClient();

(async () => {
  const creators = await prisma.creatorProfile.findMany({
    select: { userId: true, location: true, language: true },
  });
  const freelancers = await prisma.freelancerProfile.findMany({
    select: { userId: true, location: true, language: true },
  });

  let created = 0;
  for (const p of creators) {
    await ensureUserTag({ userId: p.userId, role: 'CREATOR', location: p.location, language: p.language });
    created++;
  }
  for (const p of freelancers) {
    await ensureUserTag({ userId: p.userId, role: 'FREELANCER', location: p.location, language: p.language });
    created++;
  }

  console.log(`Backfilled tags for ${created} profile(s) (${creators.length} creators, ${freelancers.length} freelancers).`);
  await prisma.$disconnect();
})();
