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

module.exports = {
  syncPremiumStatus
};
