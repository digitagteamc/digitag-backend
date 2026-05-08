/**
 * Seed script: complete creator 9550025971, create freelancer 9550025972,
 * and create a collab request between them.
 * Run: node scratch/seedUsers.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // ── 1. Find or create category ──────────────────────────────────────────────
  let photoCat = await prisma.category.findFirst({ where: { slug: 'photography' } });
  if (!photoCat) {
    photoCat = await prisma.category.create({
      data: {
        name: 'Photography',
        slug: 'photography',
        description: 'Content creators who specialise in photography',
        applicableRoles: ['CREATOR'],
        isActive: true,
      },
    });
    console.log('Created category Photography:', photoCat.id);
  } else {
    console.log('Found category Photography:', photoCat.id);
  }

  let editorCat = await prisma.category.findFirst({ where: { slug: 'editors' } });
  if (!editorCat) {
    editorCat = await prisma.category.create({
      data: {
        name: 'Editors',
        slug: 'editors',
        description: 'Freelancers who specialise in video/photo editing',
        applicableRoles: ['FREELANCER'],
        isActive: true,
      },
    });
    console.log('Created category Editors:', editorCat.id);
  } else {
    console.log('Found category Editors:', editorCat.id);
  }

  // ── 2. Find existing creator (9550025971) and complete profile ─────────────
  let creator = await prisma.user.findUnique({
    where: { mobileNumber: '9550025971' },
    include: { creatorProfile: true },
  });

  if (!creator) {
    creator = await prisma.user.create({
      data: {
        mobileNumber: '9550025971',
        countryCode: '+91',
        role: 'CREATOR',
        isVerified: true,
        categoryId: photoCat.id,
        lastLoginAt: new Date(),
      },
      include: { creatorProfile: true },
    });
    console.log('Created user 9550025971:', creator.id);
  } else {
    // Ensure role is CREATOR and category is set
    creator = await prisma.user.update({
      where: { id: creator.id },
      data: { role: 'CREATOR', categoryId: photoCat.id },
      include: { creatorProfile: true },
    });
    console.log('Found user 9550025971:', creator.id);
  }

  if (!creator.creatorProfile) {
    await prisma.creatorProfile.create({
      data: {
        userId: creator.id,
        name: 'Arjun Sharma',
        email: 'arjun.sharma@digitag.in',
        categoryId: photoCat.id,
        categories: ['Photography'],
        languages: ['English', 'Hindi'],
        bio: 'Professional photographer with 5+ years of experience in lifestyle and fashion photography. Available for brand collaborations.',
        location: 'Mumbai, IN',
        instagramHandle: 'arjun.captures',
        instagramFollowers: 28400,
        youtubeHandle: 'ArjunCaptures',
        youtubeFollowers: 5200,
        portfolioUrl: 'https://arjuncaptures.com',
        experienceLevel: 'ADVANCED',
        preferredCollabType: 'PAID',
        isAvailableForCollab: true,
      },
    });
    console.log('Created creator profile for 9550025971');
  } else {
    await prisma.creatorProfile.update({
      where: { userId: creator.id },
      data: {
        name: 'Arjun Sharma',
        categoryId: photoCat.id,
        categories: ['Photography'],
        languages: ['English', 'Hindi'],
        bio: 'Professional photographer with 5+ years of experience in lifestyle and fashion photography. Available for brand collaborations.',
        location: 'Mumbai, IN',
        instagramHandle: 'arjun.captures',
        instagramFollowers: 28400,
        youtubeHandle: 'ArjunCaptures',
        youtubeFollowers: 5200,
        portfolioUrl: 'https://arjuncaptures.com',
        experienceLevel: 'ADVANCED',
        preferredCollabType: 'PAID',
        isAvailableForCollab: true,
      },
    });
    console.log('Updated creator profile for 9550025971');
  }

  // Mark profile as complete
  await prisma.user.update({
    where: { id: creator.id },
    data: { isProfileCompleted: true },
  });

  // ── 3. Create a post for the creator ────────────────────────────────────────
  const existingPost = await prisma.post.findFirst({ where: { userId: creator.id } });
  let post;
  if (!existingPost) {
    post = await prisma.post.create({
      data: {
        userId: creator.id,
        role: 'CREATOR',
        description: 'Looking for brands to collaborate on lifestyle photography campaigns.\n\nI specialise in clean, editorial-style shots for fashion, wellness, and F&B brands. DM to discuss rates and availability.',
        location: 'Mumbai, IN',
        collaborationType: 'PAID',
        isActive: true,
      },
    });
    console.log('Created post for 9550025971:', post.id);
  } else {
    post = existingPost;
    console.log('Post already exists for 9550025971:', post.id);
  }

  // ── 4. Create freelancer (9550025972) ───────────────────────────────────────
  let freelancer = await prisma.user.findUnique({
    where: { mobileNumber: '9550025972' },
    include: { freelancerProfile: true },
  });

  if (!freelancer) {
    freelancer = await prisma.user.create({
      data: {
        mobileNumber: '9550025972',
        countryCode: '+91',
        role: 'FREELANCER',
        isVerified: true,
        categoryId: editorCat.id,
        lastLoginAt: new Date(),
      },
      include: { freelancerProfile: true },
    });
    console.log('Created user 9550025972:', freelancer.id);
  } else {
    freelancer = await prisma.user.update({
      where: { id: freelancer.id },
      data: { role: 'FREELANCER', categoryId: editorCat.id },
      include: { freelancerProfile: true },
    });
    console.log('Found user 9550025972:', freelancer.id);
  }

  if (!freelancer.freelancerProfile) {
    await prisma.freelancerProfile.create({
      data: {
        userId: freelancer.id,
        name: 'Priya Mehta',
        email: 'priya.mehta@digitag.in',
        categoryId: editorCat.id,
        categories: ['Editors'],
        languages: ['English', 'Hindi', 'Marathi'],
        bio: 'Video editor & colorist with 3 years of experience working with digital creators and brands. Specialise in Reels, YouTube shorts, and cinematic edits.',
        location: 'Pune, IN',
        skills: ['Video Editing', 'Color Grading', 'Motion Graphics', 'Premiere Pro', 'DaVinci Resolve'],
        hourlyRate: 800,
        experienceLevel: 'INTERMEDIATE',
        portfolioUrl: 'https://priyaedits.in',
        availability: 'AVAILABLE',
        servicesOffered: 'Short-form video editing, YouTube video editing, Instagram Reels, Colour grading, Motion graphics',
        instagramHandle: 'priya.edits',
      },
    });
    console.log('Created freelancer profile for 9550025972');
  } else {
    await prisma.freelancerProfile.update({
      where: { userId: freelancer.id },
      data: {
        name: 'Priya Mehta',
        categoryId: editorCat.id,
        categories: ['Editors'],
        languages: ['English', 'Hindi', 'Marathi'],
        bio: 'Video editor & colorist with 3 years of experience working with digital creators and brands. Specialise in Reels, YouTube shorts, and cinematic edits.',
        location: 'Pune, IN',
        skills: ['Video Editing', 'Color Grading', 'Motion Graphics', 'Premiere Pro', 'DaVinci Resolve'],
        hourlyRate: 800,
        experienceLevel: 'INTERMEDIATE',
        portfolioUrl: 'https://priyaedits.in',
        availability: 'AVAILABLE',
        servicesOffered: 'Short-form video editing, YouTube video editing, Instagram Reels, Colour grading, Motion graphics',
        instagramHandle: 'priya.edits',
      },
    });
    console.log('Updated freelancer profile for 9550025972');
  }

  // Mark freelancer profile as complete
  await prisma.user.update({
    where: { id: freelancer.id },
    data: { isProfileCompleted: true },
  });

  // ── 5. Create collab request: freelancer → creator's post ───────────────────
  const existingCollab = await prisma.collaboration.findFirst({
    where: { senderId: freelancer.id, receiverId: creator.id },
  });

  if (!existingCollab) {
    const collab = await prisma.collaboration.create({
      data: {
        senderId: freelancer.id,
        receiverId: creator.id,
        postId: post.id,
        message: "Hi Arjun! I'm a video editor based in Pune and I love your photography style. I'd love to help you create Reels and short-form content from your shoots. Let's connect!",
        status: 'PENDING',
      },
    });
    console.log('Created collab request:', collab.id);
  } else {
    console.log('Collab request already exists:', existingCollab.id);
  }

  console.log('\n✅ Seed complete!');
  console.log('  Creator  9550025971 →', creator.id);
  console.log('  Freelancer 9550025972 →', freelancer.id);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
