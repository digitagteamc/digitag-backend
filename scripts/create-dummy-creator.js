/**
 * Dev-only script: create one dummy creator with a complete, populated
 * profile so brand-side collaboration flows can be tested end to end.
 * Run: node scripts/create-dummy-creator.js
 *
 * Safe to re-run — skips if the creator already exists. Do not run against
 * production.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function ensureDummyCreator() {
  const mobileNumber = '7775552221';
  const existing = await prisma.user.findFirst({ where: { mobileNumber, role: 'CREATOR' } });
  if (existing) {
    console.log(`[creator] ${mobileNumber} already exists (id ${existing.id}), skipping.`);
    return;
  }

  const category = await prisma.category.findUnique({ where: { slug: 'fashion-lifestyle' } });

  const user = await prisma.user.create({
    data: {
      mobileNumber,
      countryCode: '+91',
      role: 'CREATOR',
      isVerified: true,
      isProfileCompleted: true,
      categoryId: category?.id,
    },
  });

  await prisma.creatorProfile.create({
    data: {
      userId: user.id,
      name: 'Arjun Test Creator',
      bio: 'Dummy creator for dev testing. Fashion and lifestyle content, open to paid brand collaborations.',
      categoryId: category?.id,
      categories: ['Fashion & Lifestyle'],
      languages: ['English', 'Hindi'],
      language: 'English',
      location: 'Hyderabad, Telangana',
      instagramHandle: '@arjun.testcreator',
      instagramFollowers: 120000,
      experienceLevel: 'Intermediate',
      preferredCollabType: 'PAID',
      isAvailableForCollab: true,
    },
  });

  await prisma.post.create({
    data: {
      userId: user.id,
      role: 'CREATOR',
      description: 'Open to brand collaborations — reels, stories and product reviews for fashion and lifestyle brands.',
      location: 'Hyderabad, Telangana',
      collaborationType: 'PAID',
      category: 'Fashion & Lifestyle',
      budget: '25000',
    },
  });

  console.log(`[creator] Created ${mobileNumber} — Arjun Test Creator (id ${user.id})`);
}

ensureDummyCreator()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
