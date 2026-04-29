// =====================================================
// DigiTag — Prisma seed script
// Run: npx prisma db seed
// =====================================================

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// -------------------------
// Seed data
// -------------------------

const CATEGORIES = [
  {
    name: "Video Editing",
    slug: "video-editing",
    description: "Professional video editing and post-production",
    applicableRoles: ["CREATOR", "FREELANCER"],
  },
  {
    name: "Photography",
    slug: "photography",
    description: "Product, lifestyle, and portrait photography",
    applicableRoles: ["CREATOR", "FREELANCER"],
  },
  {
    name: "Graphic Design",
    slug: "graphic-design",
    description: "Branding, illustration, and visual content design",
    applicableRoles: ["CREATOR", "FREELANCER"],
  },
  {
    name: "Content Writing",
    slug: "content-writing",
    description: "Copywriting, blogs, scripts, and captions",
    applicableRoles: ["CREATOR", "FREELANCER"],
  },
  {
    name: "Social Media",
    slug: "social-media",
    description: "Social media strategy, management, and growth",
    applicableRoles: ["CREATOR", "FREELANCER"],
  },
  {
    name: "Music Production",
    slug: "music-production",
    description: "Original compositions, beats, and audio production",
    applicableRoles: ["CREATOR", "FREELANCER"],
  },
];

// 3 creators
const CREATOR_USERS = [
  {
    mobileNumber: "9111111111",
    countryCode: "+91",
    role: "CREATOR",
    isVerified: true,
    isProfileCompleted: true,
    categorySlug: "social-media",
    profile: {
      name: "Aarav Sharma",
      bio: "Lifestyle creator based in Mumbai. I collaborate with brands that align with mindful living and travel.",
      language: "Hindi, English",
      location: "Mumbai, Maharashtra",
      instagramHandle: "@aarav.sharma",
      instagramFollowers: 128000,
      preferredCollabType: "PAID",
      isAvailableForCollab: true,
    },
  },
  {
    mobileNumber: "9222222222",
    countryCode: "+91",
    role: "CREATOR",
    isVerified: true,
    isProfileCompleted: true,
    categorySlug: "photography",
    profile: {
      name: "Priya Nair",
      bio: "Food & travel content creator from Kerala. Passionate about showcasing authentic Indian cuisine to the world.",
      language: "Malayalam, English",
      location: "Kochi, Kerala",
      instagramHandle: "@priya.nair.food",
      instagramFollowers: 87500,
      preferredCollabType: "PAID",
      isAvailableForCollab: true,
    },
  },
  {
    mobileNumber: "9333333333",
    countryCode: "+91",
    role: "CREATOR",
    isVerified: true,
    isProfileCompleted: true,
    categorySlug: "video-editing",
    profile: {
      name: "Rohan Verma",
      bio: "Tech & gaming content creator. Building a community around indie gaming and mobile tech reviews.",
      language: "Hindi, English",
      location: "Bengaluru, Karnataka",
      instagramHandle: "@rohan.techverse",
      instagramFollowers: 54200,
      preferredCollabType: "UNPAID",
      isAvailableForCollab: false,
    },
  },
];

// 2 freelancers
const FREELANCER_USERS = [
  {
    mobileNumber: "9444444444",
    countryCode: "+91",
    role: "FREELANCER",
    isVerified: true,
    isProfileCompleted: true,
    categorySlug: "graphic-design",
    profile: {
      name: "Kavya Reddy",
      bio: "Freelance graphic designer with 5+ years of experience crafting brand identities, social media kits, and motion graphics.",
      language: "Telugu, English",
      location: "Hyderabad, Telangana",
      skills: ["Adobe Illustrator", "Figma", "After Effects", "Canva Pro", "Brand Identity"],
      hourlyRate: "1200.00",
      experienceLevel: "ADVANCED",
      availability: "AVAILABLE",
      servicesOffered:
        "Brand identity design, social media content kits, logo design, motion graphics, thumbnail design for YouTube/Instagram.",
    },
  },
  {
    mobileNumber: "9555555555",
    countryCode: "+91",
    role: "FREELANCER",
    isVerified: true,
    isProfileCompleted: true,
    categorySlug: "video-editing",
    profile: {
      name: "Arjun Mehta",
      bio: "Video editor and colorist specialising in short-form content for Instagram Reels and YouTube Shorts. 3 years in the industry.",
      language: "Gujarati, Hindi, English",
      location: "Ahmedabad, Gujarat",
      skills: ["Premiere Pro", "DaVinci Resolve", "Final Cut Pro", "Color Grading", "Sound Design"],
      hourlyRate: "950.00",
      experienceLevel: "INTERMEDIATE",
      availability: "AVAILABLE",
      servicesOffered:
        "Reels / Shorts editing, long-form YouTube video editing, color grading, subtitles & captions, thumbnail creation.",
    },
  },
];

// Posts — at least 1 per creator, 1+ per freelancer
// userIndex refers to the index in CREATOR_USERS or FREELANCER_USERS
const POST_TEMPLATES = [
  {
    role: "CREATOR",
    userIndex: 0, // Aarav Sharma
    description:
      "Looking to collaborate with travel or wellness brands for a 3-day Mumbai staycation campaign. I bring authentic storytelling with high engagement rates. Open to paid collaborations only. DM to discuss!",
    location: "Mumbai, Maharashtra",
    collaborationType: "PAID",
  },
  {
    role: "CREATOR",
    userIndex: 1, // Priya Nair
    description:
      "Seeking a food brand partner for a 'Kerala Kitchen Series' across my Instagram and YouTube. 4-post series covering traditional recipes with modern twists. 87K+ engaged food enthusiasts in my audience.",
    location: "Kochi, Kerala",
    collaborationType: "PAID",
  },
  {
    role: "CREATOR",
    userIndex: 2, // Rohan Verma
    description:
      "Open for an unpaid collaboration with indie game studios — I review mobile and PC games for my tech-savvy community. Great for brand awareness if you are launching a new title. Let us connect!",
    location: "Bengaluru, Karnataka",
    collaborationType: "UNPAID",
  },
  {
    role: "FREELANCER",
    userIndex: 0, // Kavya Reddy
    description:
      "Available for brand identity and social media kit projects this month. Delivering high-quality Figma-ready files with full brand guidelines. Starting at Rs 12,000 per project. Portfolio available on request.",
    location: "Hyderabad, Telangana",
    collaborationType: "PAID",
  },
  {
    role: "FREELANCER",
    userIndex: 1, // Arjun Mehta
    description:
      "Taking new clients for Reels & Shorts editing — fast turnaround (48 hrs), cinematic colour grading, and snappy transitions. Perfect for creators who want to level up their video content. Reach out!",
    location: "Ahmedabad, Gujarat",
    collaborationType: "PAID",
  },
  {
    role: "FREELANCER",
    userIndex: 0, // Kavya Reddy — second post
    description:
      "Offering thumbnail design services for YouTube creators. Scroll-stopping visuals that boost click-through rates. Packages start at Rs 500 per thumbnail or Rs 3,500 for a batch of 10.",
    location: "Hyderabad, Telangana",
    collaborationType: "PAID",
  },
];

// -------------------------
// Main seed function
// -------------------------

async function main() {
  console.log("Starting DigiTag seed...\n");

  await prisma.$transaction(
    async (tx) => {
      // --------------------------------------------------
      // 1. Upsert Categories
      // --------------------------------------------------
      console.log("Seeding categories...");
      const categoryMap = {}; // slug -> id

      for (const cat of CATEGORIES) {
        const upserted = await tx.category.upsert({
          where: { slug: cat.slug },
          update: {
            name: cat.name,
            description: cat.description,
            applicableRoles: cat.applicableRoles,
            isActive: true,
          },
          create: {
            name: cat.name,
            slug: cat.slug,
            description: cat.description,
            applicableRoles: cat.applicableRoles,
            isActive: true,
          },
        });
        categoryMap[cat.slug] = upserted.id;
        console.log(`  [category] ${upserted.name}`);
      }

      // --------------------------------------------------
      // 2. Create Creator Users + Profiles
      // --------------------------------------------------
      console.log("\nSeeding creator users...");
      const creatorUsers = [];

      for (const u of CREATOR_USERS) {
        const existing = await tx.user.findUnique({
          where: { mobileNumber: u.mobileNumber },
        });

        if (existing) {
          console.log(
            `  [creator] ${u.profile.name} (${u.mobileNumber}) — already exists, skipping.`
          );
          creatorUsers.push(existing);
          continue;
        }

        const user = await tx.user.create({
          data: {
            mobileNumber: u.mobileNumber,
            countryCode: u.countryCode,
            role: u.role,
            isVerified: u.isVerified,
            isProfileCompleted: u.isProfileCompleted,
            categoryId: categoryMap[u.categorySlug],
          },
        });

        await tx.creatorProfile.create({
          data: {
            userId: user.id,
            categoryId: categoryMap[u.categorySlug],
            ...u.profile,
          },
        });

        console.log(`  [creator] ${u.profile.name} created`);
        creatorUsers.push(user);
      }

      // --------------------------------------------------
      // 3. Create Freelancer Users + Profiles
      // --------------------------------------------------
      console.log("\nSeeding freelancer users...");
      const freelancerUsers = [];

      for (const u of FREELANCER_USERS) {
        const existing = await tx.user.findUnique({
          where: { mobileNumber: u.mobileNumber },
        });

        if (existing) {
          console.log(
            `  [freelancer] ${u.profile.name} (${u.mobileNumber}) — already exists, skipping.`
          );
          freelancerUsers.push(existing);
          continue;
        }

        const user = await tx.user.create({
          data: {
            mobileNumber: u.mobileNumber,
            countryCode: u.countryCode,
            role: u.role,
            isVerified: u.isVerified,
            isProfileCompleted: u.isProfileCompleted,
            categoryId: categoryMap[u.categorySlug],
          },
        });

        await tx.freelancerProfile.create({
          data: {
            userId: user.id,
            categoryId: categoryMap[u.categorySlug],
            ...u.profile,
          },
        });

        console.log(`  [freelancer] ${u.profile.name} created`);
        freelancerUsers.push(user);
      }

      // --------------------------------------------------
      // 4. Create Posts
      // --------------------------------------------------
      console.log("\nSeeding posts...");

      for (const tmpl of POST_TEMPLATES) {
        const user =
          tmpl.role === "CREATOR"
            ? creatorUsers[tmpl.userIndex]
            : freelancerUsers[tmpl.userIndex];

        if (!user) {
          console.warn(
            `  [post] Could not resolve user index ${tmpl.userIndex} for role ${tmpl.role} — skipping.`
          );
          continue;
        }

        // Idempotency: skip if same user already has an identical description
        const existing = await tx.post.findFirst({
          where: { userId: user.id, description: tmpl.description },
        });

        if (existing) {
          console.log(`  [post] Post for userId ${user.id} already exists — skipping.`);
          continue;
        }

        await tx.post.create({
          data: {
            userId: user.id,
            role: tmpl.role,
            description: tmpl.description,
            location: tmpl.location,
            collaborationType: tmpl.collaborationType,
          },
        });

        const ownerList =
          tmpl.role === "CREATOR" ? CREATOR_USERS : FREELANCER_USERS;
        const ownerName = ownerList[tmpl.userIndex].profile.name;
        console.log(`  [post] Created for ${tmpl.role} ${ownerName}`);
      }

      // --------------------------------------------------
      // 5. Final summary
      // --------------------------------------------------
      const [userCount, creatorCount, freelancerCount, postCount, categoryCount] =
        await Promise.all([
          tx.user.count(),
          tx.creatorProfile.count(),
          tx.freelancerProfile.count(),
          tx.post.count(),
          tx.category.count(),
        ]);

      console.log("\nSeed complete!");
      console.log(`  Categories  : ${categoryCount}`);
      console.log(`  Users       : ${userCount}`);
      console.log(`  Creators    : ${creatorCount}`);
      console.log(`  Freelancers : ${freelancerCount}`);
      console.log(`  Posts       : ${postCount}`);
    },
    // Interactive transactions can time out; give it plenty of room
    { timeout: 30000 }
  );
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });