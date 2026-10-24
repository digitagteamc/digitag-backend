const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');
const s3UploadService = require('../../services/s3/s3Upload.service');
const logger = require('../../utils/logger');

// Data URL → buffer, checking the bytes really are a PNG / JPEG.
function decodeSignature(dataUrl) {
  const [, mime, b64] = dataUrl.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/) || [];
  if (!mime) throw ApiError.badRequest('Signature must be a PNG or JPG image.');
  const buffer = Buffer.from(b64, 'base64');
  const isPng = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (!(mime === 'image/png' ? isPng : isJpeg)) throw ApiError.badRequest('Signature must be a PNG or JPG image.');
  return { buffer, mime, ext: mime === 'image/png' ? '.png' : '.jpg' };
}

async function logActivity(admin, action, target) {
  await prisma.adminActivityLog
    .create({ data: { adminId: admin.id, adminName: admin.name, action, target } })
    .catch(() => {});
}

// -------------------------
// Public — website Celebrity panel
// -------------------------

/** Signed onboarding (steps 1–6), filled in by the DigiTag team with the
 *  celebrity. Creates the application straight into the review queue. */
async function submitOnboarding(data, meta) {
  const { buffer, mime, ext } = decodeSignature(data.signature);
  const { key } = await s3UploadService.uploadBuffer({
    buffer, mimeType: mime, prefix: 'celebrity-signatures', originalName: `signature${ext}`,
  });

  const now = new Date();
  try {
    const application = await prisma.celebrityApplication.create({
      data: {
        status: 'SUBMITTED',
        name: data.legalName,
        category: data.partnerType,
        termsAcceptedAt: now,
        onboardingDate: data.onboardingDate,
        effectiveDate: data.effectiveDate,
        legalName: data.legalName,
        partnerType: data.partnerType,
        instagramHandles: data.instagramHandles,
        youtubeChannels: data.youtubeChannels,
        brandIntegrations: data.brandIntegrations,
        managementAgreed: true,
        signatureKey: key,
        signedName: data.signedName,
        signedDate: data.signedDate,
        submittedAt: now,
        ipAddress: meta.ip || null,
        userAgent: (meta.userAgent || '').slice(0, 500) || null,
      },
      select: { id: true, status: true },
    });
    logger.info('Celebrity onboarding submitted', { id: application.id });
    return application;
  } catch (err) {
    // Don't leave an orphaned signature in S3.
    await s3UploadService.deleteObject(key).catch(() => {});
    throw err;
  }
}

// -------------------------
// Admin — /admin/celebrity-applications
// -------------------------

const listSelect = {
  id: true, status: true, name: true, phone: true, email: true, category: true, partnerType: true,
  legalName: true, submittedAt: true, reviewedAt: true, reviewedBy: true, createdAt: true,
};

async function listApplications(query = {}) {
  const where = {};
  if (query.status) where.status = query.status;
  if (query.search) {
    where.OR = ['name', 'email', 'phone', 'legalName', 'category'].map((f) => ({
      [f]: { contains: query.search, mode: 'insensitive' },
    }));
  }
  const { skip, take, page, limit } = parsePagination(query);
  const [items, total] = await Promise.all([
    prisma.celebrityApplication.findMany({
      where, select: listSelect, skip, take,
      // Review queue reads oldest first; everything else newest first.
      orderBy: query.status === 'SUBMITTED' ? { submittedAt: 'asc' } : { createdAt: 'desc' },
    }),
    prisma.celebrityApplication.count({ where }),
  ]);
  return { items, meta: buildPaginationMeta({ total, page, limit }) };
}

async function getApplication(id) {
  const application = await prisma.celebrityApplication.findUnique({ where: { id } });
  if (!application) throw ApiError.notFound('Application not found');
  const { submitTokenHash, signatureKey, ...rest } = application;
  const signatureUrl = await s3UploadService.getSignedReadUrl(signatureKey).catch(() => null);
  return { ...rest, signatureUrl };
}

async function reviewApplication(admin, id, decision, reason = null) {
  const application = await prisma.celebrityApplication.findUnique({ where: { id }, select: { status: true, name: true } });
  if (!application) throw ApiError.notFound('Application not found');
  if (application.status !== 'SUBMITTED') {
    throw ApiError.conflict(application.status === 'REQUESTED'
      ? 'This applicant has not finished onboarding yet'
      : `This application is already ${application.status.toLowerCase()}`);
  }
  // Conditional on still being SUBMITTED so two admins can't both act on it.
  const { count } = await prisma.celebrityApplication.updateMany({
    where: { id, status: 'SUBMITTED' },
    data: {
      status: decision,
      rejectionReason: decision === 'REJECTED' ? reason || null : null,
      reviewedAt: new Date(),
      reviewedBy: admin.name,
    },
  });
  if (count === 0) throw ApiError.conflict('This application was just reviewed by another admin');
  await logActivity(admin, decision === 'APPROVED' ? 'Approved celebrity application' : 'Rejected celebrity application', application.name);
  return getApplication(id);
}

module.exports = { submitOnboarding, listApplications, getApplication, reviewApplication };
