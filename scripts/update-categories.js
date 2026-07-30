/**
 * One-time script: sync categories in the live DB to the correct role split.
 * Run: node scripts/update-categories.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CREATOR_CATEGORIES = [
  { name: 'Fashion & Lifestyle',  slug: 'fashion-lifestyle',       applicableRoles: ['CREATOR'] },
  { name: 'Beauty & Skincare',    slug: 'beauty-skincare',         applicableRoles: ['CREATOR'] },
  { name: 'Fitness & Health',     slug: 'fitness-health',          applicableRoles: ['CREATOR'] },
  { name: 'Tech',                 slug: 'tech',                    applicableRoles: ['CREATOR'] },
  { name: 'Food & Cooking',       slug: 'food-cooking',            applicableRoles: ['CREATOR'] },
  { name: 'Travel',               slug: 'travel',                  applicableRoles: ['CREATOR'] },
  { name: 'Lifestyle',            slug: 'lifestyle',               applicableRoles: ['CREATOR'] },
  { name: 'Gaming',               slug: 'gaming',                  applicableRoles: ['CREATOR'] },
  { name: 'Education',            slug: 'education',               applicableRoles: ['CREATOR'] },
  { name: 'Business & Finance',   slug: 'business-finance',        applicableRoles: ['CREATOR'] },
  { name: 'Art & Creativity',     slug: 'art-creativity',          applicableRoles: ['CREATOR'] },
  { name: 'Sports',               slug: 'sports',                  applicableRoles: ['CREATOR'] },
  { name: 'Music',                slug: 'music',                   applicableRoles: ['CREATOR'] },
  { name: 'Parenting',            slug: 'parenting',               applicableRoles: ['CREATOR'] },
  { name: 'Home & Garden',        slug: 'home-garden',             applicableRoles: ['CREATOR'] },
  { name: 'Entertainment',        slug: 'entertainment',           applicableRoles: ['CREATOR'] },
];

const FREELANCER_CATEGORIES = [
  { name: 'Video Editing',            slug: 'video-editing',            applicableRoles: ['FREELANCER'] },
  { name: 'Photography',              slug: 'photography',              applicableRoles: ['FREELANCER'] },
  { name: 'Graphic Design',           slug: 'graphic-design',           applicableRoles: ['FREELANCER'] },
  { name: 'Content Writing',          slug: 'content-writing',          applicableRoles: ['FREELANCER'] },
  { name: 'Social Media Manager',     slug: 'social-media-management',  applicableRoles: ['FREELANCER'] },
  { name: 'Music Production',         slug: 'music-production',         applicableRoles: ['FREELANCER'] },
];

async function main() {
  const all = [...CREATOR_CATEGORIES, ...FREELANCER_CATEGORIES];

  for (const cat of all) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, applicableRoles: cat.applicableRoles, isActive: true },
      create: { name: cat.name, slug: cat.slug, applicableRoles: cat.applicableRoles, isActive: true },
    });
    console.log(`✓ ${cat.name} [${cat.applicableRoles.join(', ')}]`);
  }

  // Fix old "Social Media" slug → now split into role-specific entries
  // Deactivate the old combined "social-media" entry if it exists
  await prisma.category.updateMany({
    where: { slug: 'social-media' },
    data: { isActive: false },
  });

  console.log('\nDone. Restart the backend to clear the category cache.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
