const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');

const blankToNull = (v) => (v === '' || v === undefined ? null : v);

async function create(data, { ipAddress, userAgent }) {
  const hasSocial = [data.instagramUrl, data.youtubeUrl, data.facebookUrl, data.twitterUrl, data.linkedinUrl, data.otherSocialUrl]
    .some((v) => v && v.trim());
  if (!hasSocial) throw ApiError.badRequest('Add at least one social media link');

  const row = await prisma.creatorOnboarding.create({
    data: {
      fullName: data.fullName,
      mobileNumber: data.mobileNumber,
      email: data.email,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      gender: blankToNull(data.gender),
      city: data.city,
      state: data.state,
      languages: blankToNull(data.languages),
      category: data.category,
      bio: blankToNull(data.bio),
      instagramUrl: blankToNull(data.instagramUrl),
      instagramFollowers: data.instagramFollowers ?? null,
      youtubeUrl: blankToNull(data.youtubeUrl),
      youtubeSubscribers: data.youtubeSubscribers ?? null,
      facebookUrl: blankToNull(data.facebookUrl),
      twitterUrl: blankToNull(data.twitterUrl),
      linkedinUrl: blankToNull(data.linkedinUrl),
      otherSocialUrl: blankToNull(data.otherSocialUrl),
      referredBy: blankToNull(data.referredBy),
      agreementVersion: data.agreementVersion,
      signedName: data.signedName,
      signatureImage: data.signatureImage,
      agreedAt: new Date(),
      ipAddress: ipAddress || null,
      userAgent: userAgent ? userAgent.slice(0, 500) : null,
    },
    select: { id: true, createdAt: true },
  });
  return row;
}

async function adminList(query = {}) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = {};
  if (query.search) {
    where.OR = [
      { fullName: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { mobileNumber: { contains: query.search, mode: 'insensitive' } },
      { city: { contains: query.search, mode: 'insensitive' } },
      { category: { contains: query.search, mode: 'insensitive' } },
      { referredBy: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.creatorOnboarding.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.creatorOnboarding.count({ where }),
  ]);
  return { items, meta: buildPaginationMeta({ total, page, limit }) };
}

module.exports = { create, adminList };
