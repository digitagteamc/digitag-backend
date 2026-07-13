const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const STATUS = require('../../constants/statusCodes');
const service = require('./admin.service');

// ─── Auth ─────────────────────────────────────────────────────────────────────

const login = asyncHandler(async (req, res) => {
  const data = await service.loginAdmin(req.body);
  return success(res, { message: MESSAGES.ADMIN.LOGIN_SUCCESS, data });
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

const getStats = asyncHandler(async (req, res) => {
  const data = await service.getDashboardStats(req.query);
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

// ─── Activity Logs ────────────────────────────────────────────────────────────

const getActivityLogs = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listActivityLogs(req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
});

module.exports = {
  login,
  getStats,
  getUsers,
  getUser,
  suspendUser,
  unsuspendUser,
  deleteUser,
  getCreators,
  getFreelancers,
  getPosts,
  hidePost,
  restorePost,
  approvePost,
  deletePost,
  getCollaborations,
  getChats,
  getReports,
  updateReport,
  getBlocks,
  getSubscriptions,
  grantPremium,
  revokePremium,
  getCategories,
  createCategory,
  updateCategory,
  getActivityLogs,
};
