const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('./admin.controller');
const { authenticateAdmin } = require('../../middlewares/adminAuthMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const v = require('./admin.validation');

const router = Router();

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Try again later.' },
});

// ─── Public ───────────────────────────────────────────────────────────────────
// POST /admin/login
router.post('/login', adminLoginLimiter, validateRequest({ body: v.login }), controller.login);

// ─── Protected (admin JWT required for all routes below) ──────────────────────
router.use(authenticateAdmin);

// Dashboard
// GET /admin/stats?from=&to=
router.get('/stats', validateRequest({ query: v.statsQuery }), controller.getStats);

// Users
// GET /admin/users?page=&limit=&search=&role=&status=
router.get('/users', validateRequest({ query: v.listQuery }), controller.getUsers);
// GET /admin/users/:id
router.get('/users/:id', validateRequest({ params: v.idParam }), controller.getUser);
// POST /admin/users/:id/suspend
router.post('/users/:id/suspend', validateRequest({ params: v.idParam }), controller.suspendUser);
// POST /admin/users/:id/unsuspend
router.post('/users/:id/unsuspend', validateRequest({ params: v.idParam }), controller.unsuspendUser);
// DELETE /admin/users/:id
router.delete('/users/:id', validateRequest({ params: v.idParam }), controller.deleteUser);

// Creators
// GET /admin/creators?page=&limit=&search=
router.get('/creators', validateRequest({ query: v.listQuery }), controller.getCreators);

// Freelancers
// GET /admin/freelancers?page=&limit=&search=
router.get('/freelancers', validateRequest({ query: v.listQuery }), controller.getFreelancers);

// Posts
// GET /admin/posts?page=&limit=&search=&role=&status=
router.get('/posts', validateRequest({ query: v.postListQuery }), controller.getPosts);
// POST /admin/posts/:id/hide
router.post('/posts/:id/hide', validateRequest({ params: v.idParam }), controller.hidePost);
// POST /admin/posts/:id/restore
router.post('/posts/:id/restore', validateRequest({ params: v.idParam }), controller.restorePost);
// POST /admin/posts/:id/approve
router.post('/posts/:id/approve', validateRequest({ params: v.idParam }), controller.approvePost);
// DELETE /admin/posts/:id
router.delete('/posts/:id', validateRequest({ params: v.idParam }), controller.deletePost);

// Collaborations
// GET /admin/collaborations?page=&limit=&status=
router.get('/collaborations', validateRequest({ query: v.collabListQuery }), controller.getCollaborations);

// Chats
// GET /admin/chats?page=&limit=&search=
router.get('/chats', validateRequest({ query: v.listQuery }), controller.getChats);

// Reports
// GET /admin/reports?page=&limit=&status=&type=
router.get('/reports', validateRequest({ query: v.reportListQuery }), controller.getReports);
// PATCH /admin/reports/:id  { status: "reviewed" | "dismissed" }
router.patch('/reports/:id', validateRequest({ params: v.idParam, body: v.reviewReport }), controller.updateReport);

// Blocks
// GET /admin/blocks?page=&limit=
router.get('/blocks', validateRequest({ query: v.blockListQuery }), controller.getBlocks);

// Subscriptions
// GET /admin/subscriptions?page=&limit=&search=&status=
router.get('/subscriptions', validateRequest({ query: v.subscriptionListQuery }), controller.getSubscriptions);
// POST /admin/subscriptions/:id/grant — manual override, does not touch Razorpay
router.post('/subscriptions/:id/grant', validateRequest({ params: v.idParam }), controller.grantPremium);
// POST /admin/subscriptions/:id/revoke
router.post('/subscriptions/:id/revoke', validateRequest({ params: v.idParam }), controller.revokePremium);

// Categories
// GET /admin/categories?page=&limit=&search=
router.get('/categories', validateRequest({ query: v.categoryListQuery }), controller.getCategories);
// POST /admin/categories
router.post('/categories', validateRequest({ body: v.createCategory }), controller.createCategory);
// PATCH /admin/categories/:id
router.patch('/categories/:id', validateRequest({ params: v.idParam, body: v.updateCategory }), controller.updateCategory);

// Activity Logs
// GET /admin/activity-logs?page=&limit=
router.get('/activity-logs', validateRequest({ query: v.listQuery }), controller.getActivityLogs);

module.exports = router;
