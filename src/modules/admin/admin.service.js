const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const env = require('../../config/env');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');
const cache = require('../../services/cache/cache.service');
const categoryService = require('../categories/category.service');
const logger = require('../../utils/logger');
const { syncPremiumStatus } = require('../../utils/userHelpers');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function signAdminToken(admin) {
  return jwt.sign(
    { sub: admin.id, role: 'ADMIN', type: 'access' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '8h' },
  );
}

// Short-lived, deliberately NOT role: 'ADMIN' — authenticateAdmin rejects it,
// so it can only ever be exchanged via verifyTwoFactorLogin, never used to
// call a real admin route.
function signTwoFactorPendingToken(admin) {
  return jwt.sign(
    { sub: admin.id, role: 'ADMIN_2FA_PENDING', type: 'access' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '5m' },
  );
}

function truncate(str, len = 60) {
  if (!str) return '';
  return str.length > len ? `${str.slice(0, len)}…` : str;
}

function userBaseInclude() {
  return {
    category: { select: { id: true, name: true } },
    // Admin-only internal tag (location+language+role+random) — never
    // returned by any user-facing endpoint, only here.
    userTags: { select: { role: true, tag: true } },
    creatorProfile: {
      select: {
        name: true, email: true, profilePicture: true, location: true,
        instagramHandle: true, instagramFollowers: true,
        youtubeHandle: true, youtubeFollowers: true,
        twitterHandle: true, snapchatHandle: true, facebookHandle: true,
        experienceLevel: true, preferredCollabType: true, categories: true,
      },
    },
    freelancerProfile: {
      select: {
        name: true, email: true, profilePicture: true, location: true,
        skills: true, hourlyRate: true, experienceLevel: true, portfolioUrl: true,
        availability: true, categories: true,
      },
    },
  };
}

async function resolveUserCategories(users) {
  const ids = [];
  for (const u of users) ids.push(...(u.creatorProfile?.categories || []), ...(u.freelancerProfile?.categories || []));
  return categoryService.resolveCategoryMap(ids);
}

function shapeProfileCategories(profile, categoryMap) {
  if (!profile) return [];
  return (profile.categories || []).map((id) => categoryMap.get(id)?.name).filter(Boolean);
}

// Admin/staff-only internal tag for this user's active role — never exposed
// on any user-facing endpoint (userBaseInclude() is only used by admin.service).
function shapeDigiTag(user) {
  return user.userTags?.find((t) => t.role === user.role)?.tag || null;
}

function shapeUser(user) {
  const cp = user.creatorProfile;
  const fp = user.freelancerProfile;
  const profile = cp || fp;
  // Deleted accounts tombstone their number as `deleted:<ts>:<original>` to
  // free the unique slot for re-registration — show admins the original.
  const rawNumber = user.mobileNumber.startsWith('deleted:')
    ? user.mobileNumber.split(':').slice(2).join(':')
    : user.mobileNumber;
  return {
    id: user.id,
    name: profile?.name || null,
    email: profile?.email || null,
    phone: `${user.countryCode}${rawNumber}`,
    role: user.role.toLowerCase(),
    status: user.status === 'ACTIVE' ? 'active' : user.status === 'DELETED' ? 'deleted' : 'suspended',
    joinedAt: user.createdAt.toISOString(),
    avatar: profile?.profilePicture || null,
    digiTag: shapeDigiTag(user),
  };
}

function shapeCreator(user, categoryMap = new Map()) {
  const base = shapeUser(user);
  const cp = user.creatorProfile;
  const socialLinks = [];
  if (cp?.instagramHandle) socialLinks.push({ platform: 'Instagram', url: `https://instagram.com/${cp.instagramHandle.replace('@', '')}` });
  if (cp?.youtubeHandle) socialLinks.push({ platform: 'YouTube', url: `https://youtube.com/@${cp.youtubeHandle.replace('@', '')}` });
  if (cp?.twitterHandle) socialLinks.push({ platform: 'Twitter', url: `https://twitter.com/${cp.twitterHandle.replace('@', '')}` });
  if (cp?.snapchatHandle) socialLinks.push({ platform: 'Snapchat', url: `https://snapchat.com/add/${cp.snapchatHandle.replace('@', '')}` });
  if (cp?.facebookHandle) socialLinks.push({ platform: 'Facebook', url: `https://facebook.com/${cp.facebookHandle.replace('@', '')}` });
  const categories = shapeProfileCategories(cp, categoryMap);
  return {
    ...base,
    category: categories[0] || null,
    categories,
    location: cp?.location || null,
    followers: cp?.instagramFollowers || 0,
    socialLinks,
  };
}

function shapeFreelancer(user, categoryMap = new Map()) {
  const base = shapeUser(user);
  const fp = user.freelancerProfile;
  return {
    ...base,
    skills: fp?.skills || [],
    categories: shapeProfileCategories(fp, categoryMap),
    experience: fp?.experienceLevel || null,
    location: fp?.location || null,
    portfolioLinks: fp?.portfolioUrl ? [fp.portfolioUrl] : [],
  };
}

function shapePost(post, reportCount = 0) {
  const profile = post.user?.creatorProfile || post.user?.freelancerProfile;
  let status = 'active';
  if (!post.isActive) status = 'deleted';
  else if (post.isHidden) status = 'hidden';
  else if (reportCount > 0) status = 'reported';

  return {
    id: post.id,
    title: truncate(post.description),
    description: post.description,
    imageUrl: post.imageUrl || null,
    authorId: post.userId,
    authorName: profile?.name || null,
    authorAvatar: profile?.profilePicture || null,
    authorRole: post.role.toLowerCase(),
    status,
    createdAt: post.createdAt.toISOString(),
    expiresAt: post.expiresAt ? post.expiresAt.toISOString() : null,
    reportCount,
  };
}

function shapeCollab(collab) {
  const senderRole = collab.sender?.role;
  const isCreatorSender = senderRole === 'CREATOR';
  const creator = isCreatorSender ? collab.sender : collab.receiver;
  const freelancer = isCreatorSender ? collab.receiver : collab.sender;
  const creatorProfile = creator?.creatorProfile;
  const freelancerProfile = freelancer?.freelancerProfile;

  const STATUS_MAP = {
    PENDING: 'pending',
    ACCEPTED: 'active',
    DECLINED: 'cancelled',
    CANCELLED: 'cancelled',
    COMPLETED: 'completed',
  };

  return {
    id: collab.id,
    creatorName: creatorProfile?.name || creator?.mobileNumber || null,
    freelancerName: freelancerProfile?.name || freelancer?.mobileNumber || null,
    postTitle: collab.post ? truncate(collab.post.description) : '—',
    status: STATUS_MAP[collab.status] || 'pending',
    createdAt: collab.createdAt.toISOString(),
    lastActivity: collab.updatedAt.toISOString(),
  };
}

function shapeChatThread(convo) {
  const profileA = convo.participantA?.creatorProfile || convo.participantA?.freelancerProfile;
  const profileB = convo.participantB?.creatorProfile || convo.participantB?.freelancerProfile;
  const nameA = profileA?.name || convo.participantA?.mobileNumber || 'Unknown';
  const nameB = profileB?.name || convo.participantB?.mobileNumber || 'Unknown';
  const lastMsg = convo.messages?.at(-1);

  return {
    id: convo.id,
    participantA: nameA,
    participantB: nameB,
    lastMessage: lastMsg?.content || '',
    lastActivity: (convo.lastMessageAt || convo.createdAt).toISOString(),
    messageCount: convo._count?.messages ?? convo.messages?.length ?? 0,
    messages: (convo.messages || []).map((m) => ({
      id: m.id,
      from: m.senderId === convo.participantAId ? nameA : nameB,
      to: m.senderId === convo.participantAId ? nameB : nameA,
      text: m.content,
      sentAt: m.createdAt.toISOString(),
    })),
  };
}

function shapeReport(report) {
  const reporter = report.reporter;
  const reporterProfile = reporter?.creatorProfile || reporter?.freelancerProfile;
  return {
    id: report.id,
    type: report.type.toLowerCase(),
    targetId: report.targetId,
    targetName: report.targetName,
    reason: report.reason,
    reportedBy: reporterProfile?.name || reporter?.mobileNumber || 'Unknown',
    reportedAt: report.createdAt.toISOString(),
    status: report.status.toLowerCase(),
  };
}

function shapeBlockUser(user) {
  const profile = user?.creatorProfile || user?.freelancerProfile;
  return profile?.name || user?.mobileNumber || 'Unknown';
}

function shapeBlock(block) {
  return {
    id: block.id,
    blocker: shapeBlockUser(block.blocker),
    blocked: shapeBlockUser(block.blocked),
    createdAt: block.createdAt.toISOString(),
  };
}

function shapeCategory(category) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description || null,
    applicableRoles: category.applicableRoles,
    isActive: category.isActive,
    createdAt: category.createdAt.toISOString(),
  };
}

function shapeLog(log) {
  return {
    id: log.id,
    adminName: log.adminName,
    action: log.action,
    target: log.target,
    timestamp: log.createdAt.toISOString(),
  };
}

async function logAdminAction(adminId, adminName, action, target = '—') {
  await prisma.adminActivityLog.create({ data: { adminId, adminName, action, target } });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function loginAdmin({ email, password }) {
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin) throw ApiError.unauthorized(MESSAGES.ADMIN.INVALID_CREDENTIALS);
  if (!admin.isActive) throw ApiError.forbidden(MESSAGES.ADMIN.ACCOUNT_INACTIVE);

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) throw ApiError.unauthorized(MESSAGES.ADMIN.INVALID_CREDENTIALS);

  if (admin.twoFactorEnabled) {
    // Password alone isn't enough — hand back a short-lived pending token the
    // client must exchange (with a TOTP code) at /admin/2fa/verify-login.
    return { requiresTwoFactor: true, tempToken: signTwoFactorPendingToken(admin) };
  }

  await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  await logAdminAction(admin.id, admin.name, 'Login');

  const token = signAdminToken(admin);
  return { token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role, twoFactorEnabled: admin.twoFactorEnabled } };
}

async function verifyTwoFactorLogin(tempToken, code) {
  let payload;
  try {
    payload = jwt.verify(tempToken, env.JWT_ACCESS_SECRET);
  } catch {
    throw ApiError.unauthorized('Two-factor session expired — please log in again');
  }
  if (payload.role !== 'ADMIN_2FA_PENDING') throw ApiError.unauthorized('Invalid session');

  const admin = await prisma.adminUser.findUnique({ where: { id: payload.sub } });
  if (!admin || !admin.isActive) throw ApiError.unauthorized(MESSAGES.ADMIN.INVALID_CREDENTIALS);

  const ok = speakeasy.totp.verify({ secret: admin.twoFactorSecret, encoding: 'base32', token: code, window: 1 });
  if (!ok) throw ApiError.unauthorized('Invalid authentication code');

  await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  await logAdminAction(admin.id, admin.name, 'Login (2FA)');

  const token = signAdminToken(admin);
  return { token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role, twoFactorEnabled: admin.twoFactorEnabled } };
}

// ─── Two-factor setup (already-logged-in admin securing their own account) ────

async function setupTwoFactor(adminId) {
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin) throw ApiError.notFound(MESSAGES.ADMIN.USER_NOT_FOUND);

  const secret = speakeasy.generateSecret({ name: `DigiTag Admin (${admin.email})` });
  // Stored immediately but twoFactorEnabled stays false until confirmed via
  // enableTwoFactor — otherwise a generated-but-never-scanned secret would
  // silently lock the admin out of nothing (still password-only) which is
  // fine, but we don't want a half-set-up secret treated as "on".
  await prisma.adminUser.update({ where: { id: adminId }, data: { twoFactorSecret: secret.base32 } });

  const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);
  return { secret: secret.base32, qrDataUrl };
}

async function enableTwoFactor(adminId, code) {
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin) throw ApiError.notFound(MESSAGES.ADMIN.USER_NOT_FOUND);
  if (!admin.twoFactorSecret) throw ApiError.badRequest('Call setup first to generate a secret');

  const ok = speakeasy.totp.verify({ secret: admin.twoFactorSecret, encoding: 'base32', token: code, window: 1 });
  if (!ok) throw ApiError.badRequest('Invalid authentication code');

  await prisma.adminUser.update({ where: { id: adminId }, data: { twoFactorEnabled: true } });
  await logAdminAction(adminId, admin.name, 'Enabled two-factor authentication');
  return { ok: true };
}

async function disableTwoFactor(adminId) {
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin) throw ApiError.notFound(MESSAGES.ADMIN.USER_NOT_FOUND);
  await prisma.adminUser.update({ where: { id: adminId }, data: { twoFactorEnabled: false, twoFactorSecret: null } });
  await logAdminAction(adminId, admin.name, 'Disabled two-factor authentication');
  return { ok: true };
}

// ─── Team management (Super Admin only) ────────────────────────────────────────

function shapeAdmin(a) {
  return {
    id: a.id, name: a.name, email: a.email, role: a.role, isActive: a.isActive,
    twoFactorEnabled: a.twoFactorEnabled, lastLoginAt: a.lastLoginAt ? a.lastLoginAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
  };
}

async function listAdmins() {
  const admins = await prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
  return admins.map(shapeAdmin);
}

async function createAdmin(actorId, actorName, { name, email, password, role }) {
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) throw ApiError.conflict('An admin with this email already exists');
  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.adminUser.create({ data: { name, email, passwordHash, role } });
  await logAdminAction(actorId, actorName, `Created admin (${role})`, email);
  return shapeAdmin(admin);
}

async function updateAdmin(actorId, actorName, targetId, { role, isActive }) {
  if (targetId === actorId && (role !== undefined || isActive === false)) {
    throw ApiError.badRequest("You can't change your own role or deactivate your own account");
  }
  const admin = await prisma.adminUser.findUnique({ where: { id: targetId } });
  if (!admin) throw ApiError.notFound(MESSAGES.ADMIN.USER_NOT_FOUND);

  const data = {};
  if (role !== undefined) data.role = role;
  if (isActive !== undefined) data.isActive = isActive;
  const updated = await prisma.adminUser.update({ where: { id: targetId }, data });
  await logAdminAction(actorId, actorName, `Updated admin (${Object.keys(data).join(', ')})`, admin.email);
  return shapeAdmin(updated);
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

async function getDashboardStats({ from, to } = {}) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const dateFilter = from && to
    ? { createdAt: { gte: new Date(from), lte: new Date(to) } }
    : {};

  const nonAdminFilter = { role: { not: 'ADMIN' }, status: { not: 'DELETED' } };

  const [
    totalUsers,
    totalCreators,
    totalFreelancers,
    totalBrands,
    newToday,
    newThisWeek,
    newThisMonth,
    totalPosts,
    activePosts,
    deletedPosts,
    suspendedAccounts,
    totalCollaborations,
    totalMessages,
  ] = await Promise.all([
    // "User overview" is the platform's current composition, not activity in
    // the selected range (that's what "New signups" and "Content &
    // engagement" below are for) — so totalUsers must NOT apply dateFilter,
    // or it stops summing to totalCreators + totalFreelancers + totalBrands
    // (which never did) the moment a range is selected.
    prisma.user.count({ where: nonAdminFilter }),
    prisma.user.count({ where: { role: 'CREATOR', status: { not: 'DELETED' } } }),
    prisma.user.count({ where: { role: 'FREELANCER', status: { not: 'DELETED' } } }),
    prisma.user.count({ where: { role: 'BRAND', status: { not: 'DELETED' } } }),
    prisma.user.count({ where: { ...nonAdminFilter, createdAt: { gte: startOfToday } } }),
    prisma.user.count({ where: { ...nonAdminFilter, createdAt: { gte: startOfWeek } } }),
    prisma.user.count({ where: { ...nonAdminFilter, createdAt: { gte: startOfMonth } } }),
    prisma.post.count({ where: { ...dateFilter } }),
    prisma.post.count({ where: { isActive: true, isHidden: false, ...dateFilter } }),
    prisma.post.count({ where: { isActive: false, ...dateFilter } }),
    prisma.user.count({ where: { status: 'SUSPENDED' } }),
    prisma.collaboration.count({ where: { ...dateFilter } }),
    prisma.message.count({ where: { ...dateFilter } }),
  ]);

  return {
    totalUsers,
    totalCreators,
    totalFreelancers,
    totalBrands,
    newToday,
    newThisWeek,
    newThisMonth,
    totalPosts,
    activePosts,
    deletedPosts,
    suspendedAccounts,
    totalCollaborations,
    totalMessages,
  };
}

// ─── Signup funnel (where/when users drop off before completing their profile) ─

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Buckets a UTC timestamp into a 5-hour IST window (00:00, 05:00, 10:00, 15:00,
// 20:00 IST) and returns that window's start as a UTC ISO string, so buckets
// line up with an admin's local (IST) calendar day/hour instead of UTC's.
function fiveHourBucketStart(date) {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const d = ist.getUTCDate();
  const bucketStartHourIst = Math.floor(ist.getUTCHours() / 5) * 5;
  const bucketStartIst = new Date(Date.UTC(y, m, d, bucketStartHourIst, 0, 0));
  return new Date(bucketStartIst.getTime() - IST_OFFSET_MS);
}

async function getSignupFunnel() {
  const users = await prisma.user.findMany({
    where: { role: { in: ['CREATOR', 'FREELANCER'] } },
    select: { id: true, createdAt: true, isProfileCompleted: true, role: true },
    orderBy: { createdAt: 'asc' },
  });

  const notCompletedIds = users.filter((u) => !u.isProfileCompleted).map((u) => u.id);
  const igRows = notCompletedIds.length
    ? await prisma.instagramVerification.findMany({
        where: { userId: { in: notCompletedIds } },
        select: { userId: true, status: true },
      })
    : [];
  // A user can have multiple attempts (expired retries) — VERIFIED wins if any attempt succeeded.
  const igStatusByUser = new Map();
  for (const row of igRows) {
    const current = igStatusByUser.get(row.userId);
    if (!current || row.status === 'VERIFIED') igStatusByUser.set(row.userId, row.status);
  }

  const buckets = new Map();
  for (const user of users) {
    const bucketStart = fiveHourBucketStart(user.createdAt).toISOString();
    if (!buckets.has(bucketStart)) {
      buckets.set(bucketStart, {
        bucketStart,
        total: 0,
        completed: 0,
        notCompleted: 0,
        neverStartedInstagram: 0,
        instagramPendingOrFailed: 0,
        instagramVerifiedNotCompleted: 0,
        byRole: { CREATOR: 0, FREELANCER: 0 },
      });
    }
    const bucket = buckets.get(bucketStart);
    bucket.total += 1;
    bucket.byRole[user.role] = (bucket.byRole[user.role] || 0) + 1;
    if (user.isProfileCompleted) {
      bucket.completed += 1;
    } else {
      bucket.notCompleted += 1;
      const igStatus = igStatusByUser.get(user.id);
      if (!igStatus) bucket.neverStartedInstagram += 1;
      else if (igStatus === 'VERIFIED') bucket.instagramVerifiedNotCompleted += 1;
      else bucket.instagramPendingOrFailed += 1;
    }
  }

  return {
    buckets: Array.from(buckets.values()).sort((a, b) => a.bucketStart.localeCompare(b.bucketStart)),
  };
}

// Per-user drop-off list backing the funnel buckets above. A profile row
// (name, bio, category, etc.) is only ever written once, atomically, when
// the user finishes the whole signup form — so for anyone who hasn't
// completed, there's no partial in-form progress stored server-side to
// report. The two real signals we have are: did they ever attempt Instagram
// verification (a distinct step before final submit), and how recently were
// they last active at all (still trying vs. gone quiet).
async function listDroppedOffUsers({ from, to, role } = {}) {
  const where = {
    role: role ? role : { in: ['CREATOR', 'FREELANCER'] },
    isProfileCompleted: false,
  };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      mobileNumber: true,
      countryCode: true,
      role: true,
      createdAt: true,
      lastActiveAt: true,
      lastLoginAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const ids = users.map((u) => u.id);
  const igRows = ids.length
    ? await prisma.instagramVerification.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, status: true },
      })
    : [];
  const igStatusByUser = new Map();
  for (const row of igRows) {
    const current = igStatusByUser.get(row.userId);
    if (!current || row.status === 'VERIFIED') igStatusByUser.set(row.userId, row.status);
  }

  const now = Date.now();
  return users.map((u) => {
    const lastSeen = u.lastActiveAt || u.lastLoginAt || u.createdAt;
    return {
      id: u.id,
      mobileNumber: u.mobileNumber,
      countryCode: u.countryCode,
      role: u.role,
      signedUpAt: u.createdAt,
      lastSeenAt: lastSeen,
      daysSinceSignup: Math.floor((now - u.createdAt.getTime()) / 86400000),
      daysSinceLastSeen: Math.floor((now - new Date(lastSeen).getTime()) / 86400000),
      dropOffStage: igStatusByUser.get(u.id) || 'NEVER_STARTED_INSTAGRAM',
    };
  });
}

// ─── Revenue (Super Admin only) ────────────────────────────────────────────────

// Our DB never stores the plan's price — Razorpay is the source of truth —
// so MRR is computed from a live plan lookup, not a hand-maintained env var
// that could silently drift from what Razorpay actually charges.
let planAmountCache = null; // { amount, currency, fetchedAt }
async function getActivePlanAmount() {
  if (planAmountCache && Date.now() - planAmountCache.fetchedAt < 60 * 60 * 1000) {
    return planAmountCache;
  }
  if (!env.RAZORPAY.planId) return { amount: 0, currency: 'INR' };
  try {
    const razorpay = require('../../config/razorpay');
    const plan = await razorpay.plans.fetch(env.RAZORPAY.planId);
    planAmountCache = { amount: plan.item.amount / 100, currency: plan.item.currency, fetchedAt: Date.now() };
    return planAmountCache;
  } catch (err) {
    logger.error('[revenue] failed to fetch Razorpay plan', { err: err.message });
    return { amount: 0, currency: 'INR' };
  }
}

async function getRevenueStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [activeCount, cancelledThisMonth, newThisMonth, totalEverSubscribed, plan] = await Promise.all([
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.subscription.count({ where: { status: 'CANCELLED', updatedAt: { gte: startOfMonth } } }),
    prisma.subscription.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.subscription.count(),
    getActivePlanAmount(),
  ]);

  // Simple month-over-month: active count at the start of this month ≈
  // (current active) + (cancelled this month) - (new this month) — good
  // enough for a churn-rate signal without a dedicated snapshot table.
  const activeAtMonthStart = Math.max(1, activeCount + cancelledThisMonth - newThisMonth);
  const churnRate = activeAtMonthStart > 0 ? (cancelledThisMonth / activeAtMonthStart) * 100 : 0;

  const [totalSignupsEver, premiumUsers] = await Promise.all([
    prisma.user.count({ where: { role: { not: 'ADMIN' }, status: { not: 'DELETED' } } }),
    prisma.user.count({ where: { isPremium: true } }),
  ]);
  const conversionRate = totalSignupsEver > 0 ? (premiumUsers / totalSignupsEver) * 100 : 0;

  // Last 6 months of new-subscription counts, for a simple trend chart.
  const monthly = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    monthly.push({ start, end });
  }
  const monthlyNewCounts = await Promise.all(
    monthly.map(({ start, end }) => prisma.subscription.count({ where: { createdAt: { gte: start, lt: end } } })),
  );
  const revenueTrend = monthly.map(({ start }, i) => ({
    month: start.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
    newSubscriptions: monthlyNewCounts[i],
    revenue: monthlyNewCounts[i] * plan.amount,
  }));

  return {
    mrr: activeCount * plan.amount,
    currency: plan.currency,
    activeSubscribers: activeCount,
    newThisMonth,
    cancelledThisMonth,
    churnRatePercent: Math.round(churnRate * 10) / 10,
    conversionRatePercent: Math.round(conversionRate * 10) / 10,
    totalPremiumUsers: premiumUsers,
    totalEverSubscribed,
    revenueTrend,
  };
}

// ─── Users ────────────────────────────────────────────────────────────────────

async function listUsers(query = {}) {
  const { page, limit, skip, take } = parsePagination(query);
  const { search, role, status } = query;

  // Validator only allows CREATOR/FREELANCER/BRAND/AGENCY, so assigning role directly is safe.
  // Without a role filter, exclude ADMIN accounts explicitly.
  // Deleted accounts stay listed — their rows are retained specifically so
  // the admin panel keeps full history after a user deletes their account.
  const where = {};
  where.role = role ? role : { not: 'ADMIN' };
  if (status === 'active') where.status = 'ACTIVE';
  if (status === 'suspended') where.status = 'SUSPENDED';
  if (status === 'deleted') where.status = 'DELETED';
  if (search) {
    where.OR = [
      { mobileNumber: { contains: search } },
      { creatorProfile: { name: { contains: search, mode: 'insensitive' } } },
      { creatorProfile: { email: { contains: search, mode: 'insensitive' } } },
      { freelancerProfile: { name: { contains: search, mode: 'insensitive' } } },
      { freelancerProfile: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: userBaseInclude() }),
    prisma.user.count({ where }),
  ]);

  return { items: items.map(shapeUser), meta: buildPaginationMeta({ total, page, limit }) };
}

async function getUserById(id) {
  const user = await prisma.user.findUnique({ where: { id }, include: userBaseInclude() });
  if (!user) throw ApiError.notFound(MESSAGES.ADMIN.USER_NOT_FOUND);
  return shapeUser(user);
}

async function suspendUser(adminId, adminName, userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status === 'DELETED') throw ApiError.notFound(MESSAGES.ADMIN.USER_NOT_FOUND);
  if (user.status === 'SUSPENDED') throw ApiError.conflict('User is already suspended');
  await prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });
  await logAdminAction(adminId, adminName, 'Suspended user', user.mobileNumber);
  return { ok: true };
}

async function unsuspendUser(adminId, adminName, userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status === 'DELETED') throw ApiError.notFound(MESSAGES.ADMIN.USER_NOT_FOUND);
  if (user.status !== 'SUSPENDED') throw ApiError.conflict('User is not suspended');
  await prisma.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } });
  await logAdminAction(adminId, adminName, 'Unsuspended user', user.mobileNumber);
  return { ok: true };
}

async function deleteUser(adminId, adminName, userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status === 'DELETED') throw ApiError.notFound(MESSAGES.ADMIN.USER_NOT_FOUND);
  await prisma.user.update({ where: { id: userId }, data: { status: 'DELETED' } });
  await logAdminAction(adminId, adminName, 'Deleted user', user.mobileNumber);
  return { ok: true };
}

// Bulk suspend only — bulk delete is intentionally not offered here; a
// destructive multi-account action deserves the deliberate friction of doing
// it one at a time.
async function bulkSuspendUsers(adminId, adminName, userIds) {
  if (!Array.isArray(userIds) || userIds.length === 0) throw ApiError.badRequest('No users selected');
  if (userIds.length > 200) throw ApiError.badRequest('Too many users selected (max 200 at a time)');

  const result = await prisma.user.updateMany({
    where: { id: { in: userIds }, status: 'ACTIVE' },
    data: { status: 'SUSPENDED' },
  });
  await logAdminAction(adminId, adminName, 'Bulk suspended users', `${result.count} user(s)`);
  return { ok: true, count: result.count };
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function toCsv(rows, columns) {
  const escape = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => c.label).join(',');
  const body = rows.map((row) => columns.map((c) => escape(c.get(row))).join(',')).join('\n');
  return `${header}\n${body}`;
}

async function exportUsersCsv() {
  const users = await prisma.user.findMany({
    where: { role: { not: 'ADMIN' }, status: { not: 'DELETED' } },
    orderBy: { createdAt: 'desc' },
    include: { creatorProfile: { select: { name: true, email: true } }, freelancerProfile: { select: { name: true, email: true } } },
  });
  return toCsv(users, [
    { label: 'Name', get: (u) => u.creatorProfile?.name || u.freelancerProfile?.name || '' },
    { label: 'Email', get: (u) => u.creatorProfile?.email || u.freelancerProfile?.email || '' },
    { label: 'Phone', get: (u) => `${u.countryCode}${u.mobileNumber}` },
    { label: 'Role', get: (u) => u.role },
    { label: 'Status', get: (u) => u.status },
    { label: 'Premium', get: (u) => (u.isPremium ? 'Yes' : 'No') },
    { label: 'Joined', get: (u) => u.createdAt.toISOString() },
  ]);
}

// ─── Creators ─────────────────────────────────────────────────────────────────

async function listCreators(query = {}) {
  const { page, limit, skip, take } = parsePagination(query);
  const { search } = query;

  const where = { role: 'CREATOR', status: { not: 'DELETED' } };
  if (search) {
    where.OR = [
      { creatorProfile: { name: { contains: search, mode: 'insensitive' } } },
      { creatorProfile: { email: { contains: search, mode: 'insensitive' } } },
      { mobileNumber: { contains: search } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: userBaseInclude() }),
    prisma.user.count({ where }),
  ]);

  const categoryMap = await resolveUserCategories(items);
  return { items: items.map((u) => shapeCreator(u, categoryMap)), meta: buildPaginationMeta({ total, page, limit }) };
}

// ─── Freelancers ──────────────────────────────────────────────────────────────

async function listFreelancers(query = {}) {
  const { page, limit, skip, take } = parsePagination(query);
  const { search } = query;

  const where = { role: 'FREELANCER', status: { not: 'DELETED' } };
  if (search) {
    where.OR = [
      { freelancerProfile: { name: { contains: search, mode: 'insensitive' } } },
      { freelancerProfile: { email: { contains: search, mode: 'insensitive' } } },
      { mobileNumber: { contains: search } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: userBaseInclude() }),
    prisma.user.count({ where }),
  ]);

  const categoryMap = await resolveUserCategories(items);
  return { items: items.map((u) => shapeFreelancer(u, categoryMap)), meta: buildPaginationMeta({ total, page, limit }) };
}

// ─── Posts ────────────────────────────────────────────────────────────────────

async function listPosts(query = {}) {
  const { page, limit, skip, take } = parsePagination(query);
  const { search, role, status, sort } = query;

  const where = {};
  if (role) where.role = role;
  if (status === 'active') { where.isActive = true; where.isHidden = false; }
  else if (status === 'hidden') { where.isActive = true; where.isHidden = true; }
  else if (status === 'deleted') { where.isActive = false; }

  const postInclude = {
    user: {
      select: {
        id: true, role: true, mobileNumber: true,
        creatorProfile: { select: { name: true, profilePicture: true } },
        freelancerProfile: { select: { name: true, profilePicture: true } },
      },
    },
  };

  // 'expiry': most time remaining first (Lifetime posts have no expiresAt,
  // i.e. infinite time left, so they sort first — Postgres's default NULLS
  // FIRST for DESC already puts them there). Since expiresAt is an absolute
  // timestamp, ordering by it DESC is equivalent to ordering by (expiresAt -
  // now) DESC — "now" is the same constant for every row, so it doesn't
  // change the relative order.
  const orderBy = sort === 'expiry' ? { expiresAt: 'desc' } : { createdAt: 'desc' };

  const [rawPosts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      skip,
      take,
      orderBy,
      include: postInclude,
    }),
    prisma.post.count({ where }),
  ]);

  // Fetch report counts in one query
  const postIds = rawPosts.map((p) => p.id);
  const reportCounts = await prisma.report.groupBy({
    by: ['targetId'],
    where: { targetId: { in: postIds }, type: 'POST', status: 'PENDING' },
    _count: { targetId: true },
  });
  const reportMap = Object.fromEntries(reportCounts.map((r) => [r.targetId, r._count.targetId]));

  let items = rawPosts.map((p) => shapePost(p, reportMap[p.id] || 0));

  // Client-side filter for "reported" (needs reportCount > 0 after shaping)
  if (status === 'reported') {
    items = items.filter((p) => p.status === 'reported');
  }

  // Description search (case-insensitive) — apply after fetch since Prisma text search is limited
  if (search) {
    const lower = search.toLowerCase();
    items = items.filter(
      (p) =>
        p.description?.toLowerCase().includes(lower) ||
        p.authorName?.toLowerCase().includes(lower),
    );
  }

  return { items, meta: buildPaginationMeta({ total, page, limit }) };
}

async function hidePost(adminId, adminName, postId) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || !post.isActive) throw ApiError.notFound(MESSAGES.ADMIN.POST_NOT_FOUND);
  await prisma.post.update({ where: { id: postId }, data: { isHidden: true } });
  await logAdminAction(adminId, adminName, 'Hidden post', truncate(post.description, 40));
  return { ok: true };
}

async function restorePost(adminId, adminName, postId) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw ApiError.notFound(MESSAGES.ADMIN.POST_NOT_FOUND);
  await prisma.post.update({ where: { id: postId }, data: { isActive: true, isHidden: false } });
  await logAdminAction(adminId, adminName, 'Restored post', truncate(post.description, 40));
  return { ok: true };
}

async function approvePost(adminId, adminName, postId) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw ApiError.notFound(MESSAGES.ADMIN.POST_NOT_FOUND);
  await prisma.post.update({ where: { id: postId }, data: { isActive: true, isHidden: false } });
  await logAdminAction(adminId, adminName, 'Approved post', truncate(post.description, 40));
  return { ok: true };
}

async function deletePost(adminId, adminName, postId) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || !post.isActive) throw ApiError.notFound(MESSAGES.ADMIN.POST_NOT_FOUND);
  await prisma.post.update({ where: { id: postId }, data: { isActive: false } });
  await logAdminAction(adminId, adminName, 'Deleted post', truncate(post.description, 40));
  return { ok: true };
}

const BULK_POST_ACTIONS = {
  approve: { isActive: true, isHidden: false },
  hide: { isHidden: true },
  restore: { isActive: true, isHidden: false },
  delete: { isActive: false },
};

async function bulkModeratePosts(adminId, adminName, postIds, action) {
  const data = BULK_POST_ACTIONS[action];
  if (!data) throw ApiError.badRequest('Unknown bulk action');
  if (!Array.isArray(postIds) || postIds.length === 0) throw ApiError.badRequest('No posts selected');
  if (postIds.length > 200) throw ApiError.badRequest('Too many posts selected (max 200 at a time)');

  const result = await prisma.post.updateMany({ where: { id: { in: postIds } }, data });
  await logAdminAction(adminId, adminName, `Bulk ${action} posts`, `${result.count} post(s)`);
  return { ok: true, count: result.count };
}

// ─── Collaborations ───────────────────────────────────────────────────────────

async function listCollaborations(query = {}) {
  const { page, limit, skip, take } = parsePagination(query);
  const { status } = query;

  const STATUS_MAP = { pending: 'PENDING', active: 'ACCEPTED', cancelled: 'CANCELLED', completed: 'COMPLETED' };
  const where = {};
  if (status && STATUS_MAP[status]) where.status = STATUS_MAP[status];

  const collabInclude = {
    sender: {
      select: {
        id: true, role: true, mobileNumber: true,
        creatorProfile: { select: { name: true } },
        freelancerProfile: { select: { name: true } },
      },
    },
    receiver: {
      select: {
        id: true, role: true, mobileNumber: true,
        creatorProfile: { select: { name: true } },
        freelancerProfile: { select: { name: true } },
      },
    },
    post: { select: { description: true } },
  };

  const [items, total] = await Promise.all([
    prisma.collaboration.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: collabInclude }),
    prisma.collaboration.count({ where }),
  ]);

  return { items: items.map(shapeCollab), meta: buildPaginationMeta({ total, page, limit }) };
}

// ─── Chats ────────────────────────────────────────────────────────────────────

async function listChats(query = {}) {
  const { page, limit, skip, take } = parsePagination(query);
  const { search } = query;

  const participantInclude = {
    select: {
      id: true, mobileNumber: true,
      creatorProfile: { select: { name: true } },
      freelancerProfile: { select: { name: true } },
    },
  };

  const convoInclude = {
    participantA: participantInclude,
    participantB: participantInclude,
    messages: { orderBy: { createdAt: 'asc' }, take: 100 },
    _count: { select: { messages: true } },
  };

  const where = {};

  const [items, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      skip,
      take,
      orderBy: { lastMessageAt: 'desc' },
      include: convoInclude,
    }),
    prisma.conversation.count({ where }),
  ]);

  let shaped = items.map(shapeChatThread);

  if (search) {
    const lower = search.toLowerCase();
    shaped = shaped.filter(
      (t) =>
        t.participantA?.toLowerCase().includes(lower) ||
        t.participantB?.toLowerCase().includes(lower),
    );
  }

  return { items: shaped, meta: buildPaginationMeta({ total, page, limit }) };
}

// ─── Reports ──────────────────────────────────────────────────────────────────

async function listReports(query = {}) {
  const { page, limit, skip, take } = parsePagination(query);
  const { status, type } = query;

  const where = {};
  if (status) where.status = status.toUpperCase();
  if (type) where.type = type.toUpperCase();

  const [items, total] = await Promise.all([
    prisma.report.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: {
          select: {
            mobileNumber: true,
            creatorProfile: { select: { name: true } },
            freelancerProfile: { select: { name: true } },
          },
        },
      },
    }),
    prisma.report.count({ where }),
  ]);

  return { items: items.map(shapeReport), meta: buildPaginationMeta({ total, page, limit }) };
}

async function reviewReport(adminId, adminName, reportId, status) {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw ApiError.notFound(MESSAGES.ADMIN.REPORT_NOT_FOUND);
  const newStatus = status === 'reviewed' ? 'REVIEWED' : 'DISMISSED';
  await prisma.report.update({
    where: { id: reportId },
    data: { status: newStatus, reviewedAt: new Date() },
  });
  await logAdminAction(adminId, adminName, `${status === 'reviewed' ? 'Reviewed' : 'Dismissed'} report`, report.targetName);
  return { ok: true };
}

async function getReportSlaStats() {
  const [pending, resolved24h] = await Promise.all([
    prisma.report.findMany({ where: { status: 'PENDING' }, select: { createdAt: true } }),
    prisma.report.findMany({
      where: { status: { in: ['REVIEWED', 'DISMISSED'] }, reviewedAt: { not: null } },
      select: { createdAt: true, reviewedAt: true },
      orderBy: { reviewedAt: 'desc' },
      take: 200, // recent sample — enough for a meaningful average without scanning the whole table
    }),
  ]);

  const now = Date.now();
  const pendingAges = pending.map((r) => (now - r.createdAt.getTime()) / (1000 * 60 * 60)); // hours
  const avgPendingAgeHours = pendingAges.length ? pendingAges.reduce((a, b) => a + b, 0) / pendingAges.length : 0;
  const oldestPendingHours = pendingAges.length ? Math.max(...pendingAges) : 0;

  const resolutionTimes = resolved24h.map((r) => (r.reviewedAt.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60));
  const avgResolutionHours = resolutionTimes.length ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length : 0;

  return {
    pendingCount: pending.length,
    avgPendingAgeHours: Math.round(avgPendingAgeHours * 10) / 10,
    oldestPendingHours: Math.round(oldestPendingHours * 10) / 10,
    avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
    sampleSize: resolutionTimes.length,
  };
}

// ─── Blocks ───────────────────────────────────────────────────────────────────

async function listBlocks(query = {}) {
  const { page, limit, skip, take } = parsePagination(query);

  const userSelect = {
    mobileNumber: true,
    creatorProfile: { select: { name: true } },
    freelancerProfile: { select: { name: true } },
  };

  const [items, total] = await Promise.all([
    prisma.block.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        blocker: { select: userSelect },
        blocked: { select: userSelect },
      },
    }),
    prisma.block.count(),
  ]);

  return { items: items.map(shapeBlock), meta: buildPaginationMeta({ total, page, limit }) };
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

function shapeSubscription(sub) {
  const profile = sub.user?.creatorProfile || sub.user?.freelancerProfile;
  return {
    id: sub.id,
    userId: sub.userId,
    name: profile?.name || null,
    mobileNumber: sub.user?.mobileNumber || null,
    role: sub.user?.role || null,
    isPremium: Boolean(sub.user?.isPremium),
    status: sub.status,
    razorpaySubscriptionId: sub.razorpaySubscriptionId,
    currentStart: sub.currentStart ? sub.currentStart.toISOString() : null,
    currentEnd: sub.currentEnd ? sub.currentEnd.toISOString() : null,
    createdAt: sub.createdAt.toISOString(),
  };
}

async function listSubscriptions(query = {}) {
  const { page, limit, skip, take } = parsePagination(query);
  const { search, status } = query;

  const STATUS_MAP = {
    created: 'CREATED', authenticated: 'AUTHENTICATED', active: 'ACTIVE', pending: 'PENDING',
    halted: 'HALTED', cancelled: 'CANCELLED', completed: 'COMPLETED', expired: 'EXPIRED',
  };
  const where = {
    ...(status && STATUS_MAP[status] ? { status: STATUS_MAP[status] } : {}),
    ...(search
      ? {
          user: {
            OR: [
              { mobileNumber: { contains: search, mode: 'insensitive' } },
              { creatorProfile: { name: { contains: search, mode: 'insensitive' } } },
              { freelancerProfile: { name: { contains: search, mode: 'insensitive' } } },
            ],
          },
        }
      : {}),
  };

  const userSelect = {
    mobileNumber: true,
    role: true,
    isPremium: true,
    creatorProfile: { select: { name: true } },
    freelancerProfile: { select: { name: true } },
  };

  const [items, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: userSelect } },
    }),
    prisma.subscription.count({ where }),
  ]);

  return { items: items.map(shapeSubscription), meta: buildPaginationMeta({ total, page, limit }) };
}

// Support-case override — does not touch Razorpay. For when a payment
// succeeded on Razorpay's side but the webhook never synced (or the reverse:
// pulling access for a chargeback/dispute) without waiting on billing state.
async function grantPremium(adminId, adminName, userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status === 'DELETED') throw ApiError.notFound(MESSAGES.ADMIN.USER_NOT_FOUND);
  await syncPremiumStatus(userId, true);
  await logAdminAction(adminId, adminName, 'Granted premium (manual override)', user.mobileNumber);
  return { ok: true };
}

async function revokePremium(adminId, adminName, userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status === 'DELETED') throw ApiError.notFound(MESSAGES.ADMIN.USER_NOT_FOUND);
  await syncPremiumStatus(userId, false);
  await logAdminAction(adminId, adminName, 'Revoked premium (manual override)', user.mobileNumber);
  return { ok: true };
}

// ─── Categories ───────────────────────────────────────────────────────────────

async function listCategoriesAdmin(query = {}) {
  const { page, limit, skip, take } = parsePagination(query);
  const { search } = query;

  const where = {};
  if (search) where.name = { contains: search, mode: 'insensitive' };

  const [items, total] = await Promise.all([
    prisma.category.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    prisma.category.count({ where }),
  ]);

  return { items: items.map(shapeCategory), meta: buildPaginationMeta({ total, page, limit }) };
}

async function createCategory(adminId, adminName, data) {
  const existing = await prisma.category.findFirst({
    where: { OR: [{ name: data.name }, { slug: data.slug }] },
  });
  if (existing) throw ApiError.conflict('A category with that name or slug already exists');

  const category = await prisma.category.create({
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      applicableRoles: data.applicableRoles,
    },
  });
  await cache.delPattern('categories:*');
  await logAdminAction(adminId, adminName, 'Created category', category.name);
  return shapeCategory(category);
}

async function updateCategory(adminId, adminName, id, data) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Category not found');

  const category = await prisma.category.update({ where: { id }, data });
  await cache.delPattern('categories:*');
  await logAdminAction(adminId, adminName, 'Updated category', category.name);
  return shapeCategory(category);
}

// ─── Broadcast (Super Admin only) ──────────────────────────────────────────────

const BROADCAST_TARGETS = {
  all: { role: { not: 'ADMIN' }, status: 'ACTIVE' },
  creators: { role: 'CREATOR', status: 'ACTIVE' },
  freelancers: { role: 'FREELANCER', status: 'ACTIVE' },
  premium: { isPremium: true, status: 'ACTIVE' },
  // Logged in (OTP verified) but never finished the signup form — the
  // "complete your profile" nudge audience.
  incomplete_profile: { status: 'ACTIVE', isProfileCompleted: false },
};

function buildBroadcastWhere(target, { categoryId, userIds } = {}) {
  if (target === 'category') {
    return {
      status: 'ACTIVE',
      OR: [
        { creatorProfile: { categories: { has: categoryId } } },
        { freelancerProfile: { categories: { has: categoryId } } },
      ],
    };
  }
  if (target === 'users') {
    return { status: 'ACTIVE', id: { in: userIds } };
  }
  return BROADCAST_TARGETS[target];
}

async function broadcastNotification(adminId, adminName, { title, body, target, categoryId, userIds }) {
  const where = buildBroadcastWhere(target, { categoryId, userIds });
  if (!where) throw ApiError.badRequest('Unknown target audience');

  const [matchedUsers, devices] = await Promise.all([
    prisma.user.findMany({ where, select: { id: true, fcmToken: true } }),
    prisma.fcmDevice.findMany({ where: { user: where }, select: { token: true } }),
  ]);
  const tokens = [...new Set([
    ...devices.map((d) => d.token),
    ...matchedUsers.filter((u) => u.fcmToken).map((u) => u.fcmToken),
  ])];

  // In-app notification center entry for every matched user, regardless of
  // whether they have a push token — push can be missed (permission denied,
  // app killed, dead token); this is the durable record they'll still see.
  if (matchedUsers.length > 0) {
    await prisma.notification.createMany({
      data: matchedUsers.map((u) => ({
        userId: u.id,
        type: 'ANNOUNCEMENT',
        title,
        body,
      })),
    });
  }

  if (tokens.length === 0) {
    await logAdminAction(adminId, adminName, `Broadcast to ${target} (${matchedUsers.length} recipients, 0 with push)`, title);
    return { ok: true, recipientCount: matchedUsers.length, sentCount: 0 };
  }

  const admin = require('firebase-admin');
  const data = { type: 'ANNOUNCEMENT' };
  // Firebase's multicast caps at 500 tokens per call.
  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));

  let sentCount = 0;
  const deadTokens = [];
  for (const chunk of chunks) {
    try {
      const res = await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: { title, body },
        data,
        android: { priority: 'high' },
        apns: { headers: { 'apns-priority': '10' }, payload: { aps: { sound: 'default' } } },
      });
      sentCount += res.successCount;
      res.responses.forEach((r, i) => {
        if (!r.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(r.error?.code)) {
          deadTokens.push(chunk[i]);
        }
      });
    } catch (err) {
      logger.error('[broadcast] chunk send failed', { err: err.message });
    }
  }
  if (deadTokens.length) {
    await prisma.fcmDevice.deleteMany({ where: { token: { in: deadTokens } } }).catch(() => {});
  }

  await logAdminAction(adminId, adminName, `Broadcast to ${target} (${matchedUsers.length} recipients)`, title);
  return { ok: true, recipientCount: matchedUsers.length, sentCount };
}

// ─── Activity Logs ────────────────────────────────────────────────────────────

async function listActivityLogs(query = {}) {
  const { page, limit, skip, take } = parsePagination(query);

  const [items, total] = await Promise.all([
    prisma.adminActivityLog.findMany({ skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.adminActivityLog.count(),
  ]);

  return { items: items.map(shapeLog), meta: buildPaginationMeta({ total, page, limit }) };
}

module.exports = {
  loginAdmin,
  verifyTwoFactorLogin,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  listAdmins,
  createAdmin,
  updateAdmin,
  getDashboardStats,
  getSignupFunnel,
  listDroppedOffUsers,
  getRevenueStats,
  listUsers,
  getUserById,
  suspendUser,
  unsuspendUser,
  deleteUser,
  bulkSuspendUsers,
  exportUsersCsv,
  listCreators,
  listFreelancers,
  listPosts,
  hidePost,
  restorePost,
  approvePost,
  deletePost,
  bulkModeratePosts,
  listCollaborations,
  listChats,
  listReports,
  reviewReport,
  getReportSlaStats,
  listBlocks,
  listSubscriptions,
  grantPremium,
  revokePremium,
  listCategoriesAdmin,
  createCategory,
  updateCategory,
  broadcastNotification,
  listActivityLogs,
};
