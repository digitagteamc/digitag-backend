/**
 * One-time script: create the two App Store / Play Store reviewer demo
 * accounts with complete, populated profiles (not empty onboarding shells).
 * Run: node scripts/create-reviewer-accounts.js
 *
 * Both numbers are pre-registered as Firebase test phone numbers (fixed
 * OTP 123456, no real SMS sent) and already listed in .env's
 * PREMIUM_REVIEWER_PHONE_NUMBERS.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function ensureCreator() {
  const mobileNumber = '7775552220';
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
      name: 'Ananya Reviewer',
      bio: 'Fashion and lifestyle content creator based in Mumbai. Sharing daily style inspiration and honest brand reviews.',
      categoryId: category?.id,
      categories: ['Fashion & Lifestyle'],
      languages: ['English', 'Hindi'],
      language: 'English',
      location: 'Mumbai, Maharashtra',
      instagramHandle: '@ananya.reviewer',
      instagramFollowers: 45000,
      experienceLevel: 'Intermediate',
      preferredCollabType: 'PAID',
      isAvailableForCollab: true,
    },
  });

  await prisma.post.create({
    data: {
      userId: user.id,
      role: 'CREATOR',
      description: 'Looking for a skilled Social Media Manager to help grow my Instagram presence — planning, scheduling, and community engagement. Open to a paid monthly collaboration.',
      location: 'Mumbai, Maharashtra',
      collaborationType: 'PAID',
      category: 'Social Media Manager',
      budget: '15000',
    },
  });

  console.log(`[creator] Created ${mobileNumber} — Ananya Reviewer (id ${user.id})`);
}

async function ensureFreelancer() {
  const mobileNumber = '8886663331';
  const existing = await prisma.user.findFirst({ where: { mobileNumber, role: 'FREELANCER' } });
  if (existing) {
    console.log(`[freelancer] ${mobileNumber} already exists (id ${existing.id}), skipping.`);
    return;
  }

  const category = await prisma.category.findUnique({ where: { slug: 'social-media-management' } });

  const user = await prisma.user.create({
    data: {
      mobileNumber,
      countryCode: '+91',
      role: 'FREELANCER',
      isVerified: true,
      isProfileCompleted: true,
      categoryId: category?.id,
    },
  });

  await prisma.freelancerProfile.create({
    data: {
      userId: user.id,
      name: 'Rahul Reviewer',
      bio: 'Freelance social media manager helping creators and small brands grow their presence across Instagram and YouTube.',
      categoryId: category?.id,
      categories: ['Social Media Manager'],
      languages: ['English', 'Hindi'],
      language: 'English',
      location: 'Bengaluru, Karnataka',
      skills: ['Content Planning', 'Community Management', 'Analytics & Reporting'],
      hourlyRate: 800,
      experienceLevel: 'INTERMEDIATE',
      availability: 'AVAILABLE',
      servicesOffered: 'Full-service social media management: content calendar, scheduling, engagement, and monthly growth reports.',
      instagramHandle: '@rahul.smm',
      instagramFollowers: 8200,
    },
  });

  await prisma.post.create({
    data: {
      userId: user.id,
      role: 'FREELANCER',
      description: 'Experienced social media manager available for new clients — Instagram & YouTube growth, content planning, and community management.',
      location: 'Bengaluru, Karnataka',
      collaborationType: 'PAID',
      category: 'Social Media Manager',
      budget: '20000',
    },
  });

  console.log(`[freelancer] Created ${mobileNumber} — Rahul Reviewer (id ${user.id})`);
}

async function main() {
  await ensureCreator();
  await ensureFreelancer();
  console.log('\nDone.');
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
