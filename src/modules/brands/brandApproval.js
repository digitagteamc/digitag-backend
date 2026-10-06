const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');

// Standalone (prisma-only) so post / collaboration / ad-request services can
// use it without a require cycle through brand.service.js.

/** Throws unless this user is a brand whose KYC an admin has approved.
 *  Gates posting requirements, collaborating and sending ad requests. */
async function assertApprovedBrand(userId) {
  const profile = await prisma.brandProfile.findUnique({ where: { userId }, select: { approvalStatus: true } });
  if (!profile) throw ApiError.forbidden('Complete your brand registration first', { code: 'BRAND_PROFILE_MISSING' });
  if (profile.approvalStatus === 'PENDING') {
    throw ApiError.forbidden('Your brand is awaiting admin approval', { code: 'BRAND_PENDING_APPROVAL' });
  }
  if (profile.approvalStatus === 'REJECTED') {
    throw ApiError.forbidden('Your brand registration was not approved', { code: 'BRAND_REJECTED' });
  }
}

module.exports = { assertApprovedBrand };
