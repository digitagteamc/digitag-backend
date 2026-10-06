const { prisma } = require('../config/db');

/**
 * Updates the isPremium flag for all user profiles sharing the same Account.
 * Ensures subscription access cascades to all roles (Creator, Freelancer, etc.) 
 * linked to the same mobile number.
 *
 * @param {string} userId - The user ID whose subscription triggered the change
 * @param {boolean} isPremium - The new premium state
 */
async function syncPremiumStatus(userId, isPremium) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountId: true, mobileNumber: true }
  });
  
  if (user) {
    const whereClause = user.accountId 
      ? { accountId: user.accountId } 
      : { mobileNumber: user.mobileNumber };
      
    await prisma.user.updateMany({
      where: whereClause,
      data: { isPremium }
    });
  }
}

/** The profile row that represents this user's current role. Callers must
 *  have selected creatorProfile / freelancerProfile / brandProfile. */
function roleProfile(user) {
  if (!user) return null;
  if (user.role === 'BRAND') return user.brandProfile || null;
  if (user.role === 'FREELANCER') return user.freelancerProfile || null;
  if (user.role === 'CREATOR') return user.creatorProfile || null;
  return user.creatorProfile || user.freelancerProfile || user.brandProfile || null;
}

/** Display name for notifications etc. (brand name for Brands). */
function displayName(user, fallback = 'Someone') {
  return roleProfile(user)?.name
    || user?.creatorProfile?.name
    || user?.freelancerProfile?.name
    || user?.brandProfile?.name
    || fallback;
}

module.exports = {
  syncPremiumStatus,
  roleProfile,
  displayName,
};
