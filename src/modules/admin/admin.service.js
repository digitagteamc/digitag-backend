const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const env = require('../../config/env');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');
const cache = require('../../services/cache/cache.service');
const categoryService = require('../categories/category.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function signAdminToken(admin) {
  return jwt.sign(
    { sub: admin.id, role: 'ADMIN', type: 'access' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '8h' },
  );
}

function truncate(str, len = 60) {
  if (!str) return '';
  return str.length > len ? `${str.slice(0, len)}…` : str;
}

function userBaseInclude() {
  return {
    category: { select: { id: true, name: true } },
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

function shapeUser(user) {
  const cp = user.creatorProfile;
  const fp = user.freelancerProfile;
  const profile = cp || fp;
  return {
    id: user.id,
    name: profile?.name || null,
    email: profile?.email || null,
    phone: `${user.countryCode}${user.mobileNumber}`,
    role: user.role.toLowerCase(),
    status: user.status === 'ACTIVE' ? 'active' : 'suspended',
    joinedAt: user.createdAt.toISOString(),
    avatar: profile?.profilePicture || null,
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

  await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  await logAdminAction(admin.id, admin.name, 'Login');

  const token = signAdminToken(admin);
  return { token, admin: { id: admin.id, name: admin.name, email: admin.email } };
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
    prisma.user.count({ where: { ...nonAdminFilter, ...dateFilter } }),
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

// ─── Users ────────────────────────────────────────────────────────────────────

async function listUsers(query = {}) {
  const { page, limit, skip, take } = parsePagination(query);
  const { search, role, status } = query;

  // Validator only allows CREATOR/FREELANCER/BRAND/AGENCY, so assigning role directly is safe.
  // Without a role filter, exclude ADMIN accounts explicitly.
  const where = { status: { not: 'DELETED' } };
  where.role = role ? role : { not: 'ADMIN' };
  if (status === 'active') where.status = 'ACTIVE';
  if (status === 'suspended') where.status = 'SUSPENDED';
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
  if (!user || user.status === 'DELETED') throw ApiError.notFound(MESSAGES.ADMIN.USER_NOT_FOUND);
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
  const { search, role, status } = query;

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

  const [rawPosts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
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
  await prisma.user.update({ where: { id: userId }, data: { isPremium: true } });
  await logAdminAction(adminId, adminName, 'Granted premium (manual override)', user.mobileNumber);
  return { ok: true };
}

async function revokePremium(adminId, adminName, userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status === 'DELETED') throw ApiError.notFound(MESSAGES.ADMIN.USER_NOT_FOUND);
  await prisma.user.update({ where: { id: userId }, data: { isPremium: false } });
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
  getDashboardStats,
  listUsers,
  getUserById,
  suspendUser,
  unsuspendUser,
  deleteUser,
  listCreators,
  listFreelancers,
  listPosts,
  hidePost,
  restorePost,
  approvePost,
  deletePost,
  listCollaborations,
  listChats,
  listReports,
  reviewReport,
  listBlocks,
  listSubscriptions,
  grantPremium,
  revokePremium,
  listCategoriesAdmin,
  createCategory,
  updateCategory,
  listActivityLogs,
};
