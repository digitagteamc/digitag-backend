/**
 * One-time script: group existing User records by mobileNumber,
 * create Account records, and update User records to link to their new Account.
 * Safe to re-run — only processes User records that do not have accountId set yet.
 *
 * Run: node scripts/migrate-accounts.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('--- Starting Account Migration ---');
  
  // Find all users who do not have an accountId linked yet
  const unlinkedUsers = await prisma.user.findMany({
    where: { accountId: null }
  });

  if (unlinkedUsers.length === 0) {
    console.log('No unlinked users found. Migration is already complete!');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${unlinkedUsers.length} unlinked user profiles. Grouping by mobile number...`);

  // Group by mobile number
  const groups = {};
  for (const user of unlinkedUsers) {
    const key = user.mobileNumber;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(user);
  }

  let accountsCreatedCount = 0;
  let usersLinkedCount = 0;

  for (const [mobileNumber, users] of Object.entries(groups)) {
    // 1. Check if Account already exists for this mobile number (just in case)
    let account = await prisma.account.findUnique({
      where: { mobileNumber }
    });

    if (!account) {
      // Pick countryCode from the first user profile
      const countryCode = users[0].countryCode || '+91';
      account = await prisma.account.create({
        data: {
          mobileNumber,
          countryCode
        }
      });
      accountsCreatedCount++;
    }

    // 2. Link all users in this group to the account
    for (const user of users) {
      await prisma.user.update({
        where: { id: user.id },
        data: { accountId: account.id }
      });
      usersLinkedCount++;
    }
  }

  console.log(`Migration finished successfully!`);
  console.log(`Created ${accountsCreatedCount} new Account(s).`);
  console.log(`Linked ${usersLinkedCount} User profile(s) to Accounts.`);
  
  await prisma.$disconnect();
})();
