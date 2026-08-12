const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const STATUS = require('../../constants/statusCodes');
const service = require('./admin.service');

// ─── Auth ─────────────────────────────────────────────────────────────────────

const login = asyncHandler(async (req, res) => {
  const data = await service.loginAdmin(req.body);
  return success(res, { message: data.requiresTwoFactor ? 'Two-factor code required' : MESSAGES.ADMIN.LOGIN_SUCCESS, data });
});

const verifyTwoFactorLogin = asyncHandler(async (req, res) => {
  const data = await service.verifyTwoFactorLogin(req.body.tempToken, req.body.code);
  return success(res, { message: MESSAGES.ADMIN.LOGIN_SUCCESS, data });
});

const setupTwoFactor = asyncHandler(async (req, res) => {
  const data = await service.setupTwoFactor(req.admin.id);
  return success(res, { message: 'Scan the QR code, then confirm with a code to enable', data });
});

const enableTwoFactor = asyncHandler(async (req, res) => {
  const data = await service.enableTwoFactor(req.admin.id, req.body.code);
  return success(res, { message: 'Two-factor authentication enabled', data });
});

const disableTwoFactor = asyncHandler(async (req, res) => {
  const data = await service.disableTwoFactor(req.admin.id);
  return success(res, { message: 'Two-factor authentication disabled', data });
});

// ─── Team (Super Admin only) ────────────────────────────────────────────────────

const getAdmins = asyncHandler(async (req, res) => {
  const data = await service.listAdmins();
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data });
});

const createAdmin = asyncHandler(async (req, res) => {
  const data = await service.createAdmin(req.admin.id, req.admin.name, req.body);
  return success(res, { statusCode: STATUS.CREATED, message: MESSAGES.GENERIC.CREATED, data });
});

const updateAdmin = asyncHandler(async (req, res) => {
  const data = await service.updateAdmin(req.admin.id, req.admin.name, req.params.id, req.body);
  return success(res, { message: MESSAGES.GENERIC.UPDATED, data });
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

const getStats = asyncHandler(async (req, res) => {
  const data = await service.getDashboardStats(req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data });
});

const getRevenueStats = asyncHandler(async (req, res) => {
  const data = await service.getRevenueStats();
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data });
});

const getSignupFunnel = asyncHandler(async (req, res) => {
  const data = await service.getSignupFunnel();
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data });
});

const getDroppedOffUsers = asyncHandler(async (req, res) => {
  const data = await service.listDroppedOffUsers(req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data });
});

// ─── Users ────────────────────────────────────────────────────────────────────

const getUsers = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listUsers(req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
});

const getUser = asyncHandler(async (req, res) => {
  const data = await service.getUserById(req.params.id);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data });
});

const suspendUser = asyncHandler(async (req, res) => {
  const data = await service.suspendUser(req.admin.id, req.admin.name, req.params.id);
  return success(res, { message: MESSAGES.ADMIN.USER_SUSPENDED, data });
});

const unsuspendUser = asyncHandler(async (req, res) => {
  const data = await service.unsuspendUser(req.admin.id, req.admin.name, req.params.id);
  return success(res, { message: MESSAGES.ADMIN.USER_UNSUSPENDED, data });
});

const deleteUser = asyncHandler(async (req, res) => {
  const data = await service.deleteUser(req.admin.id, req.admin.name, req.params.id);
  return success(res, { message: MESSAGES.ADMIN.USER_DELETED, data });
});

const bulkSuspendUsers = asyncHandler(async (req, res) => {
  const data = await service.bulkSuspendUsers(req.admin.id, req.admin.name, req.body.userIds);
  return success(res, { message: 'Users suspended', data });
});

const exportUsersCsv = asyncHandler(async (req, res) => {
  const csv = await service.exportUsersCsv(req.query);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="digitag-users.csv"');
  res.send(csv);
});

// ─── Creators ─────────────────────────────────────────────────────────────────

const getCreators = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listCreators(req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
});

// ─── Freelancers ──────────────────────────────────────────────────────────────

const getFreelancers = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listFreelancers(req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
});

// ─── Posts ────────────────────────────────────────────────────────────────────

const getPosts = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listPosts(req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
});

const hidePost = asyncHandler(async (req, res) => {
  const data = await service.hidePost(req.admin.id, req.admin.name, req.params.id);
  return success(res, { message: MESSAGES.ADMIN.POST_HIDDEN, data });
});

const restorePost = asyncHandler(async (req, res) => {
  const data = await service.restorePost(req.admin.id, req.admin.name, req.params.id);
  return success(res, { message: MESSAGES.ADMIN.POST_RESTORED, data });
});

const approvePost = asyncHandler(async (req, res) => {
  const data = await service.approvePost(req.admin.id, req.admin.name, req.params.id);
  return success(res, { message: MESSAGES.ADMIN.POST_APPROVED, data });
});

const deletePost = asyncHandler(async (req, res) => {
  const data = await service.deletePost(req.admin.id, req.admin.name, req.params.id);
  return success(res, { message: MESSAGES.ADMIN.POST_DELETED, data });
});

const bulkModeratePosts = asyncHandler(async (req, res) => {
  const data = await service.bulkModeratePosts(req.admin.id, req.admin.name, req.body.postIds, req.body.action);
  return success(res, { message: 'Posts updated', data });
});

// ─── Collaborations ───────────────────────────────────────────────────────────

const getCollaborations = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listCollaborations(req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
});

// ─── Chats ────────────────────────────────────────────────────────────────────

const getChats = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listChats(req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
});

// ─── Reports ──────────────────────────────────────────────────────────────────

const getReports = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listReports(req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
});

const updateReport = asyncHandler(async (req, res) => {
  const data = await service.reviewReport(req.admin.id, req.admin.name, req.params.id, req.body.status);
  return success(res, { message: MESSAGES.ADMIN.REPORT_UPDATED, data });
});

const getReportSla = asyncHandler(async (req, res) => {
  const data = await service.getReportSlaStats();
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data });
});

// ─── Blocks ───────────────────────────────────────────────────────────────────

const getBlocks = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listBlocks(req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
});

// ─── Subscriptions ────────────────────────────────────────────────────────────

const getSubscriptions = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listSubscriptions(req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
});

const grantPremium = asyncHandler(async (req, res) => {
  const data = await service.grantPremium(req.admin.id, req.admin.name, req.params.id);
  return success(res, { message: 'Premium granted', data });
});

const revokePremium = asyncHandler(async (req, res) => {
  const data = await service.revokePremium(req.admin.id, req.admin.name, req.params.id);
  return success(res, { message: 'Premium revoked', data });
});

// ─── Categories ───────────────────────────────────────────────────────────────

const getCategories = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listCategoriesAdmin(req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
});

const createCategory = asyncHandler(async (req, res) => {
  const data = await service.createCategory(req.admin.id, req.admin.name, req.body);
  return success(res, { statusCode: STATUS.CREATED, message: MESSAGES.GENERIC.CREATED, data });
});

const updateCategory = asyncHandler(async (req, res) => {
  const data = await service.updateCategory(req.admin.id, req.admin.name, req.params.id, req.body);
  return success(res, { message: MESSAGES.GENERIC.UPDATED, data });
});

// ─── Broadcast ────────────────────────────────────────────────────────────────

const broadcast = asyncHandler(async (req, res) => {
  const data = await service.broadcastNotification(req.admin.id, req.admin.name, req.body);
  return success(res, { message: 'Broadcast sent', data });
});

// ─── Activity Logs ────────────────────────────────────────────────────────────

const getActivityLogs = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listActivityLogs(req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
});

// ─── Event registrations ────────────────────────────────────────────────────

const getEventRegistrations = asyncHandler(async (req, res) => {
  const { items, meta } = await service.adminListEventRegistrations(req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
});

const checkinEventRegistration = asyncHandler(async (req, res) => {
  const data = await service.checkinEventRegistration(req.admin.id, req.admin.name, req.body.ticketCode);
  return success(res, { message: data.alreadyCheckedIn ? 'Already checked in' : 'Checked in', data });
});

module.exports = {
  login,
  verifyTwoFactorLogin,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  getAdmins,
  createAdmin,
  updateAdmin,
  getStats,
  getSignupFunnel,
  getDroppedOffUsers,
  getRevenueStats,
  getUsers,
  getUser,
  suspendUser,
  unsuspendUser,
  deleteUser,
  bulkSuspendUsers,
  exportUsersCsv,
  getCreators,
  getFreelancers,
  getPosts,
  hidePost,
  restorePost,
  approvePost,
  deletePost,
  bulkModeratePosts,
  getCollaborations,
  getChats,
  getReports,
  updateReport,
  getReportSla,
  getBlocks,
  getSubscriptions,
  grantPremium,
  revokePremium,
  getCategories,
  createCategory,
  updateCategory,
  broadcast,
  getActivityLogs,
  getEventRegistrations,
  checkinEventRegistration,
};
