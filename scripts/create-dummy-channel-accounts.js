/**
 * Create dummy media channels with CRM logins (for testing /channel-portal).
 * Run: node scripts/create-dummy-channel-accounts.js
 *
 * Upserts each channel by slug and each ChannelUser by email, and resets the
 * password to the one listed below. Safe to re-run. Don't run against prod.
 */
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CHANNELS = [
  {
    name: 'Demo TV News', slug: 'demo-tv-news', type: 'TV', subscriberCount: 2500000,
    category: 'News', languages: ['Telugu', 'English'], region: 'Telangana',
    users: [
      { name: 'TV Owner', email: 'tv.owner@digitag.test', password: 'TvOwner@123', role: 'OWNER' },
      { name: 'TV Manager', email: 'tv.manager@digitag.test', password: 'TvManager@123', role: 'MANAGER' },
    ],
  },
  {
    name: 'Demo YouTube Tech', slug: 'demo-youtube-tech', type: 'YOUTUBE', subscriberCount: 850000,
    category: 'Technology', languages: ['English', 'Hindi'], region: 'India',
    users: [
      { name: 'YouTube Owner', email: 'yt.owner@digitag.test', password: 'YtOwner@123', role: 'OWNER' },
      { name: 'YouTube Manager', email: 'yt.manager@digitag.test', password: 'YtManager@123', role: 'MANAGER' },
    ],
  },
  {
    name: 'Demo FM Radio', slug: 'demo-fm-radio', type: 'RADIO', subscriberCount: 400000,
    category: 'Entertainment', languages: ['Telugu'], region: 'Andhra Pradesh',
    users: [
      { name: 'Radio Owner', email: 'radio.owner@digitag.test', password: 'RadioOwner@123', role: 'OWNER' },
    ],
  },
  {
    name: 'Demo OTT Play', slug: 'demo-ott-play', type: 'OTT', subscriberCount: 1200000,
    category: 'Movies', languages: ['Telugu', 'Tamil', 'Hindi'], region: 'India',
    users: [
      { name: 'OTT Owner', email: 'ott.owner@digitag.test', password: 'OttOwner@123', role: 'OWNER' },
    ],
  },
];

async function main() {
  const rows = [];
  for (const { users, ...channelData } of CHANNELS) {
    const channel = await prisma.mediaChannel.upsert({
      where: { slug: channelData.slug },
      create: { ...channelData, contactEmail: users[0].email, isActive: true, isVerified: true },
      update: { isActive: true },
    });
    console.log(`[channel] ${channel.name} (${channel.type}) id ${channel.id}`);

    for (const { password, ...u } of users) {
      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.channelUser.upsert({
        where: { email: u.email },
        create: { ...u, channelId: channel.id, passwordHash, isActive: true },
        update: { channelId: channel.id, role: u.role, passwordHash, isActive: true },
      });
      rows.push({ channel: channel.name, role: u.role, email: u.email, password });
    }
  }

  console.log('\nCRM logins (/channel-portal/login):');
  console.table(rows);
}

main()
  .catch((err) => { console.error(err.message || err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
