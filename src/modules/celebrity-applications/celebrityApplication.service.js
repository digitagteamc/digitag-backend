const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');
const s3UploadService = require('../../services/s3/s3Upload.service');
const logger = require('../../utils/logger');

// Celebrity.followerCount is a Postgres INTEGER.
const MAX_FOLLOWER_COUNT = 2_147_483_647;

const IMAGE_TYPES = {
  'image/png': { ext: '.png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/jpeg': { ext: '.jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/webp': { ext: '.webp', test: (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
};

// Data URL → buffer, checking the bytes really are one of `allowed`.
function decodeImage(dataUrl, allowed, errorMessage) {
  const [, mime, b64] = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/) || [];
  const type = allowed.includes(mime) && IMAGE_TYPES[mime];
  const buffer = type && Buffer.from(b64, 'base64');
  if (!type || !type.test(buffer)) throw ApiError.badRequest(errorMessage);
  return { buffer, mime, ext: type.ext };
}

async function uploadImage({ buffer, mime, ext }, prefix, name) {
  const { key } = await s3UploadService.uploadBuffer({ buffer, mimeType: mime, prefix, originalName: `${name}${ext}` });
  return key;
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
  // Decode both first so a bad photo doesn't leave the signature uploaded.
  const signature = decodeImage(data.signature, ['image/png', 'image/jpeg'], 'Signature must be a PNG or JPG image.');
  const photo = data.photo
    ? decodeImage(data.photo, ['image/png', 'image/jpeg', 'image/webp'], 'Profile photo must be a JPG, PNG or WEBP image.')
    : null;

  const keys = [];
  const now = new Date();
  try {
    const signatureKey = await uploadImage(signature, 'celebrity-signatures', 'signature');
    keys.push(signatureKey);
    const photoKey = photo ? await uploadImage(photo, 'celebrity-photos', 'photo') : null;
    if (photoKey) keys.push(photoKey);

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
        photoKey,
        instagramHandles: data.instagramAccounts.map((a) => a.handle),
        instagramAccounts: data.instagramAccounts,
        youtubeChannels: data.youtubeChannels,
        brandIntegrations: data.brandIntegrations,
        managementAgreed: true,
        signatureKey,
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
    // Don't leave orphaned uploads in S3.
    await Promise.all(keys.map((k) => s3UploadService.deleteObject(k).catch(() => {})));
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
  const { submitTokenHash, signatureKey, photoKey, ...rest } = application;
  const signedUrl = (key) => (key ? s3UploadService.getSignedReadUrl(key).catch(() => null) : null);
  const [signatureUrl, photoUrl] = await Promise.all([signedUrl(signatureKey), signedUrl(photoKey)]);
  return { ...rest, signatureUrl, photoUrl };
}

// Follower counts are stored as typed in the panel: 1200, 1,200, 185K, 2.4M.
function parseAudienceCount(value) {
  const [, digits, unit] = String(value ?? '').replace(/,/g, '').match(/^(\d+(?:\.\d+)?)\s*([kKmM]?)$/) || [];
  if (!digits) return 0;
  return Math.round(Number(digits) * ({ k: 1e3, m: 1e6 }[unit.toLowerCase()] ?? 1));
}

/** The Celebrity row the Brand Home "Celebrities" section lists for an approved
 *  application. The photo becomes public here: it goes out to every brand. */
function toCelebrity(application) {
  const instagram = application.instagramAccounts ?? [];
  const youtube = application.youtubeChannels ?? [];
  const instagramFollowers = instagram.reduce((sum, a) => sum + parseAudienceCount(a.followers), 0);
  const youtubeSubscribers = youtube.reduce((sum, c) => sum + parseAudienceCount(c.subscribers), 0);
  return {
    name: application.name,
    photoUrl: application.photoKey ? s3UploadService.getPublicUrl(application.photoKey) : null,
    role: application.partnerType,
    followerCount: Math.min(instagramFollowers + youtubeSubscribers, MAX_FOLLOWER_COUNT),
    isVerified: true,
    profileUrl: instagram[0] ? `https://instagram.com/${instagram[0].handle}` : youtube[0]?.url ?? null,
    instagramHandle: instagram[0]?.handle ?? null,
    instagramFollowers: Math.min(instagramFollowers, MAX_FOLLOWER_COUNT),
    youtubeUrl: youtube[0]?.url ?? null,
    youtubeSubscribers: Math.min(youtubeSubscribers, MAX_FOLLOWER_COUNT),
  };
}

async function reviewApplication(admin, id, decision, reason = null) {
  const application = await prisma.celebrityApplication.findUnique({
    where: { id },
    select: {
      status: true, name: true, partnerType: true, photoKey: true, instagramAccounts: true, youtubeChannels: true,
    },
  });
  if (!application) throw ApiError.notFound('Application not found');
  if (application.status !== 'SUBMITTED') {
    throw ApiError.conflict(application.status === 'REQUESTED'
      ? 'This applicant has not finished onboarding yet'
      : `This application is already ${application.status.toLowerCase()}`);
  }
  // Conditional on still being SUBMITTED so two admins can't both act on it.
  const count = await prisma.$transaction(async (tx) => {
    const result = await tx.celebrityApplication.updateMany({
      where: { id, status: 'SUBMITTED' },
      data: {
        status: decision,
        rejectionReason: decision === 'REJECTED' ? reason || null : null,
        reviewedAt: new Date(),
        reviewedBy: admin.name,
      },
    });
    if (result.count && decision === 'APPROVED') await tx.celebrity.create({ data: toCelebrity(application) });
    return result.count;
  });
  if (count === 0) throw ApiError.conflict('This application was just reviewed by another admin');
  await logActivity(admin, decision === 'APPROVED' ? 'Approved celebrity application' : 'Rejected celebrity application', application.name);
  return getApplication(id);
}

module.exports = { submitOnboarding, listApplications, getApplication, reviewApplication, toCelebrity };
