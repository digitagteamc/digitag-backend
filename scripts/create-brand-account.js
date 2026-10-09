/**
 * Give a phone number an approved BRAND role (for testing the brand app).
 * Run: node scripts/create-brand-account.js <mobileNumber> ["Brand Name"]
 *
 * Reuses the number's Account (Creator/Freelancer roles stay untouched), adds
 * a BRAND User under it if missing, and creates an APPROVED BrandProfile — or
 * approves the existing one. Safe to re-run. Log in with the number and pick
 * Brand (or switch role in the app).
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const [mobileNumber, brandName = 'DigiTag Test Brand'] = process.argv.slice(2);

function randomThreeDigits() {
  return String(Math.floor(Math.random() * 1000)).padStart(3, '0');
}

// Same format as src/utils/generateTagId.js (e.g. 123B456).
async function newBrandTagId() {
  for (let i = 0; i < 20; i++) {
    const tagId = `${randomThreeDigits()}B${randomThreeDigits()}`;
    if (!(await prisma.brandProfile.findUnique({ where: { tagId } }))) return tagId;
  }
  const ts = String(Date.now());
  return `${ts.slice(-3)}B${ts.slice(-6, -3)}`;
}

async function main() {
  if (!/^\d{10}$/.test(mobileNumber || '')) {
    throw new Error('Usage: node scripts/create-brand-account.js <10-digit mobileNumber> ["Brand Name"]');
  }

  const account = await prisma.account.upsert({
    where: { mobileNumber },
    create: { mobileNumber, countryCode: '+91' },
    update: {},
  });

  let user = await prisma.user.findFirst({ where: { accountId: account.id, role: 'BRAND', status: { not: 'DELETED' } } });
  if (user) {
    console.log(`[brand] BRAND user already exists (id ${user.id})`);
  } else {
    user = await prisma.user.create({
      data: { accountId: account.id, mobileNumber, countryCode: account.countryCode, role: 'BRAND', isVerified: true },
    });
    console.log(`[brand] Created BRAND user (id ${user.id})`);
  }

  const reviewed = { approvalStatus: 'APPROVED', rejectionReason: null, reviewedAt: new Date(), reviewedBy: 'create-brand-account script' };
  const existing = await prisma.brandProfile.findUnique({ where: { userId: user.id } });
  if (existing) {
    await prisma.brandProfile.update({ where: { userId: user.id }, data: reviewed });
    console.log(`[brand] Approved existing profile "${existing.name}" (tag ${existing.tagId})`);
  } else {
    const profile = await prisma.brandProfile.create({
      data: {
        userId: user.id,
        name: brandName,
        pan: 'ABCDE1234F',
        city: 'Hyderabad',
        state: 'Telangana',
        industry: 'Consumer Goods',
        tagId: await newBrandTagId(),
        ...reviewed,
      },
    });
    console.log(`[brand] Created approved profile "${profile.name}" (tag ${profile.tagId})`);
  }

  await prisma.user.update({ where: { id: user.id }, data: { isProfileCompleted: true, status: 'ACTIVE' } });

  const roles = await prisma.user.findMany({
    where: { accountId: account.id, status: { not: 'DELETED' } },
    select: { role: true, id: true },
  });
  console.log(`\n${mobileNumber} roles: ${roles.map((r) => r.role).join(', ')}`);
}

main()
  .catch((err) => { console.error(err.message || err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
