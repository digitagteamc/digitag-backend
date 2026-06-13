// =====================================================
// DigiTag — Prisma seed script
// Run: npx prisma db seed
// =====================================================

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// -------------------------
// Skill categories (backend Category model)
// -------------------------
const CATEGORIES = [
  { name: "Video Editing",   slug: "video-editing",   description: "Professional video editing and post-production",        applicableRoles: ["CREATOR", "FREELANCER"] },
  { name: "Photography",     slug: "photography",      description: "Product, lifestyle, and portrait photography",          applicableRoles: ["CREATOR", "FREELANCER"] },
  { name: "Graphic Design",  slug: "graphic-design",   description: "Branding, illustration, and visual content design",     applicableRoles: ["CREATOR", "FREELANCER"] },
  { name: "Content Writing", slug: "content-writing",  description: "Copywriting, blogs, scripts, and captions",            applicableRoles: ["CREATOR", "FREELANCER"] },
  { name: "Social Media",    slug: "social-media",     description: "Social media strategy, management, and growth",        applicableRoles: ["CREATOR", "FREELANCER"] },
  { name: "Music Production",slug: "music-production", description: "Original compositions, beats, and audio production",   applicableRoles: ["CREATOR", "FREELANCER"] },
];

// -------------------------
// Creator users — one per content niche
// categories[] must match the exact strings used in signup/creator.tsx
// -------------------------
const CREATOR_USERS = [
  {
    mobileNumber: "9111111111", countryCode: "+91", role: "CREATOR", isVerified: true, isProfileCompleted: true,
    categorySlug: "social-media",
    profile: {
      name: "Aarav Sharma", bio: "Lifestyle creator based in Mumbai. Authentic storytelling meets mindful living.", language: "Hindi, English",
      location: "Mumbai, Maharashtra", instagramHandle: "@aarav.sharma", instagramFollowers: 128000,
      preferredCollabType: "PAID", isAvailableForCollab: true,
      categories: ["Fashion & Lifestyle"],
    },
    post: {
      description: "Looking to collaborate with fashion and lifestyle brands for a 3-day Mumbai campaign. Authentic storytelling with high engagement. Open to paid collabs only — DM to discuss!",
      collaborationType: "PAID",
    },
  },
  {
    mobileNumber: "9222222222", countryCode: "+91", role: "CREATOR", isVerified: true, isProfileCompleted: true,
    categorySlug: "photography",
    profile: {
      name: "Priya Nair", bio: "Food & travel content creator from Kerala. Showcasing authentic Indian cuisine to the world.", language: "Malayalam, English",
      location: "Kochi, Kerala", instagramHandle: "@priya.nair.food", instagramFollowers: 87500,
      preferredCollabType: "PAID", isAvailableForCollab: true,
      categories: ["Food & Cooking"],
    },
    post: {
      description: "Seeking a food brand for a 'Kerala Kitchen Series' across Instagram and YouTube. 4-post series covering traditional recipes with modern twists. 87K+ engaged food enthusiasts in my audience.",
      collaborationType: "PAID",
    },
  },
  {
    mobileNumber: "9333333333", countryCode: "+91", role: "CREATOR", isVerified: true, isProfileCompleted: true,
    categorySlug: "video-editing",
    profile: {
      name: "Rohan Verma", bio: "Tech & gaming content creator. Building a community around indie gaming and mobile tech reviews.", language: "Hindi, English",
      location: "Bengaluru, Karnataka", instagramHandle: "@rohan.techverse", instagramFollowers: 54200,
      preferredCollabType: "UNPAID", isAvailableForCollab: false,
      categories: ["Gaming"],
    },
    post: {
      description: "Open for unpaid collab with indie game studios — I review mobile and PC games for my tech-savvy community. Great for brand awareness on new title launches!",
      collaborationType: "UNPAID",
    },
  },
  {
    mobileNumber: "9100000001", countryCode: "+91", role: "CREATOR", isVerified: true, isProfileCompleted: true,
    categorySlug: "social-media",
    profile: {
      name: "Meera Kapoor", bio: "Fashion and beauty creator. Curating daily style inspo for the modern Indian woman.", language: "Hindi, English",
      location: "Delhi, NCR", instagramHandle: "@meera.kapoor.style", instagramFollowers: 210000,
      preferredCollabType: "PAID", isAvailableForCollab: true,
      categories: ["Beauty & Skincare"],
    },
    post: {
      description: "Seeking skincare and beauty brand collaborations. My audience of 210K+ trusts my honest reviews and tutorials. Open to paid partnerships for product launches and campaigns.",
      collaborationType: "PAID",
    },
  },
  {
    mobileNumber: "9100000002", countryCode: "+91", role: "CREATOR", isVerified: true, isProfileCompleted: true,
    categorySlug: "video-editing",
    profile: {
      name: "Vikram Sharma", bio: "Certified fitness trainer and content creator. Sharing science-backed workouts and nutrition tips.", language: "Hindi, English",
      location: "Pune, Maharashtra", instagramHandle: "@vikram.fitlife", instagramFollowers: 95000,
      preferredCollabType: "PAID", isAvailableForCollab: true,
      categories: ["Fitness & Health"],
    },
    post: {
      description: "Looking for fitness equipment, supplement, or sportswear brands for a 30-day transformation challenge series. 95K highly engaged fitness enthusiasts ready to see your brand!",
      collaborationType: "PAID",
    },
  },
  {
    mobileNumber: "9100000003", countryCode: "+91", role: "CREATOR", isVerified: true, isProfileCompleted: true,
    categorySlug: "video-editing",
    profile: {
      name: "Aryan Patel", bio: "Tech reviewer and gadget unboxer. Breaking down complex tech into everyday language.", language: "Gujarati, Hindi, English",
      location: "Ahmedabad, Gujarat", instagramHandle: "@aryan.techreview", instagramFollowers: 73000,
      preferredCollabType: "PAID", isAvailableForCollab: true,
      categories: ["Tech"],
    },
    post: {
      description: "Open for tech product collaborations — smartphones, laptops, accessories, smart home devices. My audience actively makes purchasing decisions based on my reviews. Let's connect!",
      collaborationType: "PAID",
    },
  },
  {
    mobileNumber: "9100000004", countryCode: "+91", role: "CREATOR", isVerified: true, isProfileCompleted: true,
    categorySlug: "photography",
    profile: {
      name: "Sneha Reddy", bio: "Home cook turned food creator. Recreating restaurant dishes with affordable ingredients.", language: "Telugu, English",
      location: "Hyderabad, Telangana", instagramHandle: "@sneha.homecooks", instagramFollowers: 62000,
      preferredCollabType: "UNPAID", isAvailableForCollab: true,
      categories: ["Food & Cooking"],
    },
    post: {
      description: "Looking for kitchen appliance or FMCG brands for recipe integration posts. My audience loves practical, everyday cooking content. Open to both paid and barter collaborations.",
      collaborationType: "UNPAID",
    },
  },
  {
    mobileNumber: "9100000005", countryCode: "+91", role: "CREATOR", isVerified: true, isProfileCompleted: true,
    categorySlug: "photography",
    profile: {
      name: "Kabir Khan", bio: "Solo travel creator exploring off-beat destinations across India and Southeast Asia.", language: "Hindi, English, Urdu",
      location: "Jaipur, Rajasthan", instagramHandle: "@kabir.wanders", instagramFollowers: 145000,
      preferredCollabType: "PAID", isAvailableForCollab: true,
      categories: ["Travel"],
    },
    post: {
      description: "Available for hotel, airline, travel gear, and tourism board partnerships. Planning a 3-month South India coast route — perfect for destination and hospitality brand integrations.",
      collaborationType: "PAID",
    },
  },
  {
    mobileNumber: "9100000006", countryCode: "+91", role: "CREATOR", isVerified: true, isProfileCompleted: true,
    categorySlug: "social-media",
    profile: {
      name: "Nisha Gupta", bio: "Lifestyle and wellness creator sharing everyday moments, mindfulness, and minimalist living.", language: "Hindi, English",
      location: "Lucknow, Uttar Pradesh", instagramHandle: "@nisha.livingwell", instagramFollowers: 48000,
      preferredCollabType: "UNPAID", isAvailableForCollab: true,
      categories: ["Lifestyle"],
    },
    post: {
      description: "Open for wellness, home decor, and lifestyle brand collabs. My audience resonates with authentic, everyday content. Happy to do barter or paid partnerships.",
      collaborationType: "UNPAID",
    },
  },
  {
    mobileNumber: "9100000007", countryCode: "+91", role: "CREATOR", isVerified: true, isProfileCompleted: true,
    categorySlug: "video-editing",
    profile: {
      name: "Dev Malhotra", bio: "Gaming creator and esports analyst. Covering mobile gaming, tournaments, and tips for 1M+ views monthly.", language: "Hindi, English",
      location: "Chandigarh, Punjab", instagramHandle: "@dev.gameson", instagramFollowers: 189000,
      preferredCollabType: "PAID", isAvailableForCollab: true,
      categories: ["Gaming"],
    },
    post: {
      description: "Partnering with gaming peripherals, mobile brands, and energy drink companies for sponsored streams and Reels. 189K gamers follow my content — great ROI for gaming brands.",
      collaborationType: "PAID",
    },
  },
  {
    mobileNumber: "9100000008", countryCode: "+91", role: "CREATOR", isVerified: true, isProfileCompleted: true,
    categorySlug: "content-writing",
    profile: {
      name: "Pooja Verma", bio: "EdTech creator making learning fun. Career guidance, exam tips, and skill-building for students.", language: "Hindi, English",
      location: "Bhopal, Madhya Pradesh", instagramHandle: "@pooja.learnwithme", instagramFollowers: 82000,
      preferredCollabType: "PAID", isAvailableForCollab: true,
      categories: ["Education"],
    },
    post: {
      description: "Looking to collaborate with EdTech platforms, online course providers, and study tools. My audience is students aged 16–25 who are serious about their future. Let's build something meaningful.",
      collaborationType: "PAID",
    },
  },
  {
    mobileNumber: "9100000009", countryCode: "+91", role: "CREATOR", isVerified: true, isProfileCompleted: true,
    categorySlug: "content-writing",
    profile: {
      name: "Rahul Joshi", bio: "Finance creator making investing and personal finance accessible to young Indians.", language: "Hindi, Marathi, English",
      location: "Mumbai, Maharashtra", instagramHandle: "@rahul.moneywise", instagramFollowers: 220000,
      preferredCollabType: "PAID", isAvailableForCollab: true,
      categories: ["Business & Finance"],
    },
    post: {
      description: "Open for partnerships with fintech apps, investment platforms, and insurance brands. 220K+ financially curious followers who trust my straightforward money advice. Premium placements available.",
      collaborationType: "PAID",
    },
  },
  {
    mobileNumber: "9100000010", countryCode: "+91", role: "CREATOR", isVerified: true, isProfileCompleted: true,
    categorySlug: "graphic-design",
    profile: {
      name: "Tanya Mehta", bio: "Artist and digital illustrator. Sharing my creative process, tutorials, and behind-the-scenes.", language: "English, Hindi",
      location: "Kolkata, West Bengal", instagramHandle: "@tanya.artspace", instagramFollowers: 39000,
      preferredCollabType: "UNPAID", isAvailableForCollab: true,
      categories: ["Art & Creativity"],
    },
    post: {
      description: "Seeking art supply brands, stationery companies, and digital tool makers for creative collaboration. I produce time-lapse tutorials and process videos my engaged artist community loves.",
      collaborationType: "UNPAID",
    },
  },
  {
    mobileNumber: "9100000011", countryCode: "+91", role: "CREATOR", isVerified: true, isProfileCompleted: true,
    categorySlug: "video-editing",
    profile: {
      name: "Arjun Rao", bio: "Sports and fitness content creator. Covering cricket, football, and gym culture for Indian youth.", language: "Telugu, Kannada, English",
      location: "Bengaluru, Karnataka", instagramHandle: "@arjun.sportzone", instagramFollowers: 110000,
      preferredCollabType: "PAID", isAvailableForCollab: true,
      categories: ["Sports"],
    },
    post: {
      description: "Available for sports brand, nutrition, and activewear collaborations. I create match analysis, workout content, and sports gear reviews. Perfect fit for brands targeting the 18–30 male demographic.",
      collaborationType: "PAID",
    },
  },
  {
    mobileNumber: "9100000012", countryCode: "+91", role: "CREATOR", isVerified: true, isProfileCompleted: true,
    categorySlug: "music-production",
    profile: {
      name: "Preethi Nair", bio: "Singer-songwriter and music creator. Sharing original compositions and cover songs with a soulful twist.", language: "Malayalam, Tamil, English",
      location: "Chennai, Tamil Nadu", instagramHandle: "@preethi.sings", instagramFollowers: 66000,
      preferredCollabType: "PAID", isAvailableForCollab: true,
      categories: ["Music"],
    },
    post: {
      description: "Looking for music streaming platforms, headphone brands, or event companies for partnerships. My audience is passionate about independent music and live performances.",
      collaborationType: "PAID",
    },
  },
  {
    mobileNumber: "9100000013", countryCode: "+91", role: "CREATOR", isVerified: true, isProfileCompleted: true,
    categorySlug: "social-media",
    profile: {
      name: "Sunita Agarwal", bio: "Mom creator sharing honest parenting tips, child development hacks, and family lifestyle content.", language: "Hindi, English",
      location: "Jaipur, Rajasthan", instagramHandle: "@sunita.momlife", instagramFollowers: 53000,
      preferredCollabType: "UNPAID", isAvailableForCollab: true,
      categories: ["Parenting"],
    },
    post: {
      description: "Seeking baby care, toys, education, and family brand partnerships. My audience of moms and parents trusts my product recommendations. Open to paid and barter deals.",
      collaborationType: "UNPAID",
    },
  },
  {
    mobileNumber: "9100000014", countryCode: "+91", role: "CREATOR", isVerified: true, isProfileCompleted: true,
    categorySlug: "photography",
    profile: {
      name: "Rajesh Kumar", bio: "Interior styling and home gardening creator. Transforming small spaces into beautiful homes on a budget.", language: "Hindi, English",
      location: "Noida, Uttar Pradesh", instagramHandle: "@rajesh.homestyle", instagramFollowers: 41000,
      preferredCollabType: "UNPAID", isAvailableForCollab: true,
      categories: ["Home & Garden"],
    },
    post: {
      description: "Looking for home decor, furniture, and gardening brand collaborations. I specialize in budget makeovers and DIY content that drives strong purchase intent in my community.",
      collaborationType: "UNPAID",
    },
  },
  {
    mobileNumber: "9100000015", countryCode: "+91", role: "CREATOR", isVerified: true, isProfileCompleted: true,
    categorySlug: "video-editing",
    profile: {
      name: "Simran Kaur", bio: "Entertainment creator covering Bollywood, web series reviews, and viral trends. High energy, always fun!", language: "Punjabi, Hindi, English",
      location: "Amritsar, Punjab", instagramHandle: "@simran.entertains", instagramFollowers: 175000,
      preferredCollabType: "PAID", isAvailableForCollab: true,
      categories: ["Entertainment"],
    },
    post: {
      description: "Open for OTT platform promotions, movie or show integrations, and entertainment brand campaigns. 175K+ highly engaged entertainment lovers who consume daily content.",
      collaborationType: "PAID",
    },
  },
];

// -------------------------
// Freelancer users — one per skill category
// -------------------------
const FREELANCER_USERS = [
  {
    mobileNumber: "9444444444", countryCode: "+91", role: "FREELANCER", isVerified: true, isProfileCompleted: true,
    categorySlug: "graphic-design",
    profile: {
      name: "Kavya Reddy", bio: "Freelance graphic designer with 5+ years crafting brand identities, social media kits, and motion graphics.",
      language: "Telugu, English", location: "Hyderabad, Telangana",
      skills: ["Adobe Illustrator", "Figma", "After Effects", "Canva Pro", "Brand Identity"],
      hourlyRate: "1200.00", experienceLevel: "ADVANCED", availability: "AVAILABLE",
      servicesOffered: "Brand identity design, social media content kits, logo design, motion graphics, thumbnail design.",
      categories: ["Graphic Design"],
    },
    post: {
      description: "Available for brand identity and social media kit projects. Delivering high-quality Figma-ready files with full brand guidelines. Starting at ₹12,000 per project. Portfolio on request.",
      collaborationType: "PAID",
    },
  },
  {
    mobileNumber: "9555555555", countryCode: "+91", role: "FREELANCER", isVerified: true, isProfileCompleted: true,
    categorySlug: "video-editing",
    profile: {
      name: "Arjun Mehta", bio: "Video editor and colorist specialising in short-form content for Instagram Reels and YouTube Shorts.",
      language: "Gujarati, Hindi, English", location: "Ahmedabad, Gujarat",
      skills: ["Premiere Pro", "DaVinci Resolve", "Final Cut Pro", "Color Grading", "Sound Design"],
      hourlyRate: "950.00", experienceLevel: "INTERMEDIATE", availability: "AVAILABLE",
      servicesOffered: "Reels / Shorts editing, long-form YouTube editing, color grading, subtitles, thumbnail creation.",
      categories: ["Video Editing"],
    },
    post: {
      description: "Taking new clients for Reels & Shorts editing — fast 48hr turnaround, cinematic colour grading, snappy transitions. Perfect for creators wanting to level up their video content.",
      collaborationType: "PAID",
    },
  },
  {
    mobileNumber: "9200000001", countryCode: "+91", role: "FREELANCER", isVerified: true, isProfileCompleted: true,
    categorySlug: "photography",
    profile: {
      name: "Divya Sharma", bio: "Commercial and lifestyle photographer with a portfolio spanning e-commerce, food, and portrait photography.",
      language: "Hindi, English", location: "Delhi, NCR",
      skills: ["Product Photography", "Food Photography", "Lightroom", "Photoshop", "Studio Lighting"],
      hourlyRate: "1500.00", experienceLevel: "ADVANCED", availability: "AVAILABLE",
      servicesOffered: "Product, food, and lifestyle photography. On-site and studio shoots. Full edited gallery delivered within 3 days.",
      categories: ["Photography"],
    },
    post: {
      description: "Available for product and brand photography shoots in Delhi NCR. Studio and on-location setups. E-commerce, lookbook, and social media packages starting ₹8,000. DM to book a slot.",
      collaborationType: "PAID",
    },
  },
  {
    mobileNumber: "9200000002", countryCode: "+91", role: "FREELANCER", isVerified: true, isProfileCompleted: true,
    categorySlug: "content-writing",
    profile: {
      name: "Aishwarya Pillai", bio: "Content strategist and copywriter helping brands tell compelling stories across digital platforms.",
      language: "Malayalam, English", location: "Bengaluru, Karnataka",
      skills: ["SEO Copywriting", "Social Media Captions", "Blog Writing", "Email Marketing", "Script Writing"],
      hourlyRate: "800.00", experienceLevel: "INTERMEDIATE", availability: "AVAILABLE",
      servicesOffered: "Blog posts, Instagram captions, email campaigns, YouTube scripts, website copy. Fast delivery, SEO-optimised.",
      categories: ["Content Writing"],
    },
    post: {
      description: "Open for content writing projects — blogs, captions, scripts, and email sequences. I write for D2C brands, creators, and startups. Affordable packages with quick turnaround.",
      collaborationType: "PAID",
    },
  },
  {
    mobileNumber: "9200000003", countryCode: "+91", role: "FREELANCER", isVerified: true, isProfileCompleted: true,
    categorySlug: "social-media",
    profile: {
      name: "Kiran Desai", bio: "Social media manager helping creators and small businesses grow their online presence organically.",
      language: "Marathi, Hindi, English", location: "Pune, Maharashtra",
      skills: ["Instagram Growth", "Content Calendar", "Analytics", "Meta Ads", "Community Management"],
      hourlyRate: "700.00", experienceLevel: "INTERMEDIATE", availability: "AVAILABLE",
      servicesOffered: "Full social media management — content planning, posting, engagement, and monthly analytics reports.",
      categories: ["Social Media"],
    },
    post: {
      description: "Offering social media management for creators and brands — Instagram, YouTube, and LinkedIn. Content calendar, daily posting, engagement, and growth strategy. ₹6,000/month packages available.",
      collaborationType: "PAID",
    },
  },
  {
    mobileNumber: "9200000004", countryCode: "+91", role: "FREELANCER", isVerified: true, isProfileCompleted: true,
    categorySlug: "music-production",
    profile: {
      name: "Siddharth Roy", bio: "Music producer and sound designer creating original tracks, jingles, and audio branding for creators and brands.",
      language: "Bengali, Hindi, English", location: "Kolkata, West Bengal",
      skills: ["FL Studio", "Logic Pro", "Sound Design", "Mixing & Mastering", "Jingle Production"],
      hourlyRate: "1100.00", experienceLevel: "ADVANCED", availability: "AVAILABLE",
      servicesOffered: "Original compositions, brand jingles, background scores, podcast intros, and full mixing/mastering.",
      categories: ["Music Production"],
    },
    post: {
      description: "Available for music production projects — brand jingles, YouTube background music, podcast intro/outro, and original tracks. Quick delivery, royalty-free licensing. Portfolio on request.",
      collaborationType: "PAID",
    },
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
      const categoryMap = {};

      for (const cat of CATEGORIES) {
        const upserted = await tx.category.upsert({
          where: { slug: cat.slug },
          update: { name: cat.name, description: cat.description, applicableRoles: cat.applicableRoles, isActive: true },
          create: { name: cat.name, slug: cat.slug, description: cat.description, applicableRoles: cat.applicableRoles, isActive: true },
        });
        categoryMap[cat.slug] = upserted.id;
        console.log(`  [category] ${upserted.name}`);
      }

      // --------------------------------------------------
      // 2. Create Creator Users + Profiles + Posts
      // --------------------------------------------------
      console.log("\nSeeding creator users...");

      for (const u of CREATOR_USERS) {
        let user = await tx.user.findUnique({ where: { mobileNumber: u.mobileNumber } });

        if (user) {
          // Update existing profile to ensure categories[] is set
          await tx.creatorProfile.updateMany({
            where: { userId: user.id },
            data: { categories: u.profile.categories },
          });
          console.log(`  [creator] ${u.profile.name} (${u.mobileNumber}) — exists, updated categories`);
        } else {
          user = await tx.user.create({
            data: {
              mobileNumber: u.mobileNumber, countryCode: u.countryCode, role: u.role,
              isVerified: u.isVerified, isProfileCompleted: u.isProfileCompleted,
              categoryId: categoryMap[u.categorySlug],
            },
          });
          const { categories, ...profileRest } = u.profile;
          await tx.creatorProfile.create({
            data: { userId: user.id, categoryId: categoryMap[u.categorySlug], categories, ...profileRest },
          });
          console.log(`  [creator] ${u.profile.name} created`);
        }

        // One post per creator (idempotent)
        const existingPost = await tx.post.findFirst({ where: { userId: user.id, description: u.post.description } });
        if (!existingPost) {
          await tx.post.create({
            data: {
              userId: user.id, role: "CREATOR",
              description: u.post.description,
              location: u.profile.location,
              collaborationType: u.post.collaborationType,
              category: u.profile.categories[0],
            },
          });
          console.log(`  [post] Created for creator ${u.profile.name} (${u.profile.categories[0]})`);
        } else {
          console.log(`  [post] Already exists for creator ${u.profile.name} — skipping`);
        }
      }

      // --------------------------------------------------
      // 3. Create Freelancer Users + Profiles + Posts
      // --------------------------------------------------
      console.log("\nSeeding freelancer users...");

      for (const u of FREELANCER_USERS) {
        let user = await tx.user.findUnique({ where: { mobileNumber: u.mobileNumber } });

        if (user) {
          // Update existing profile to ensure categories[] is set
          await tx.freelancerProfile.updateMany({
            where: { userId: user.id },
            data: { categories: u.profile.categories },
          });
          console.log(`  [freelancer] ${u.profile.name} (${u.mobileNumber}) — exists, updated categories`);
        } else {
          user = await tx.user.create({
            data: {
              mobileNumber: u.mobileNumber, countryCode: u.countryCode, role: u.role,
              isVerified: u.isVerified, isProfileCompleted: u.isProfileCompleted,
              categoryId: categoryMap[u.categorySlug],
            },
          });
          const { categories, ...profileRest } = u.profile;
          await tx.freelancerProfile.create({
            data: { userId: user.id, categoryId: categoryMap[u.categorySlug], categories, ...profileRest },
          });
          console.log(`  [freelancer] ${u.profile.name} created`);
        }

        // One post per freelancer (idempotent)
        const existingPost = await tx.post.findFirst({ where: { userId: user.id, description: u.post.description } });
        if (!existingPost) {
          await tx.post.create({
            data: {
              userId: user.id, role: "FREELANCER",
              description: u.post.description,
              location: u.profile.location,
              collaborationType: u.post.collaborationType,
              category: u.profile.categories[0],
            },
          });
          console.log(`  [post] Created for freelancer ${u.profile.name} (${u.profile.categories[0]})`);
        } else {
          console.log(`  [post] Already exists for freelancer ${u.profile.name} — skipping`);
        }
      }

      // --------------------------------------------------
      // 4. Seed default admin user
      // --------------------------------------------------
      console.log("\nSeeding admin user...");
      const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL || "admin@digitag.ai";
      const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD || "admin123";
      const existingAdmin = await tx.adminUser.findUnique({ where: { email: ADMIN_EMAIL } });
      if (existingAdmin) {
        console.log(`  [admin] ${ADMIN_EMAIL} already exists — skipping.`);
      } else {
        const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
        await tx.adminUser.create({ data: { name: "Admin", email: ADMIN_EMAIL, passwordHash } });
        console.log(`  [admin] Created ${ADMIN_EMAIL} (password: ${ADMIN_PASSWORD})`);
      }

      // --------------------------------------------------
      // 5. Final summary
      // --------------------------------------------------
      const [userCount, creatorCount, freelancerCount, postCount, categoryCount] = await Promise.all([
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
    { timeout: 60000 }
  );
}

main()
  .catch((err) => { console.error("Seed failed:", err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
