const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('./admin.controller');
const { authenticateAdmin, requireSuperAdmin } = require('../../middlewares/adminAuthMiddleware');
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
// POST /admin/login — returns { token, admin } directly, or { requiresTwoFactor: true, tempToken } if 2FA is on
router.post('/login', adminLoginLimiter, validateRequest({ body: v.login }), controller.login);
// POST /admin/2fa/verify-login — exchange tempToken + TOTP code for a real session
router.post('/2fa/verify-login', adminLoginLimiter, validateRequest({ body: v.verifyTwoFactorLogin }), controller.verifyTwoFactorLogin);

// ─── Protected (admin JWT required for all routes below) ──────────────────────
router.use(authenticateAdmin);

// Two-factor self-service (any admin, for their own account)
// POST /admin/2fa/setup — generates a secret + QR code
router.post('/2fa/setup', controller.setupTwoFactor);
// POST /admin/2fa/enable — confirm with a code to turn it on
router.post('/2fa/enable', validateRequest({ body: v.twoFactorCode }), controller.enableTwoFactor);
// POST /admin/2fa/disable
router.post('/2fa/disable', controller.disableTwoFactor);

// Team management — Super Admin only
// GET /admin/team
router.get('/team', requireSuperAdmin, controller.getAdmins);
// POST /admin/team
router.post('/team', requireSuperAdmin, validateRequest({ body: v.createAdmin }), controller.createAdmin);
// PATCH /admin/team/:id
router.patch('/team/:id', requireSuperAdmin, validateRequest({ params: v.idParam, body: v.updateAdmin }), controller.updateAdmin);

// Dashboard
// GET /admin/stats?from=&to=
router.get('/stats', validateRequest({ query: v.statsQuery }), controller.getStats);
// GET /admin/signup-funnel — where/when signups drop off, bucketed into 5-hour IST windows
router.get('/signup-funnel', controller.getSignupFunnel);
// GET /admin/signup-funnel/users?from=&to=&role= — the individual users behind those buckets
router.get('/signup-funnel/users', validateRequest({ query: v.droppedOffUsersQuery }), controller.getDroppedOffUsers);
// GET /admin/revenue — Super Admin only (financial data)
router.get('/revenue', requireSuperAdmin, controller.getRevenueStats);

// Users — specific paths before /:id so they aren't swallowed by the param route
// GET /admin/users/export.csv — Super Admin only (PII export)
router.get('/users/export.csv', requireSuperAdmin, controller.exportUsersCsv);
// POST /admin/users/bulk-suspend
router.post('/users/bulk-suspend', requireSuperAdmin, validateRequest({ body: v.bulkUserIds }), controller.bulkSuspendUsers);
// GET /admin/users?page=&limit=&search=&role=&status=
router.get('/users', validateRequest({ query: v.listQuery }), controller.getUsers);
// GET /admin/users/:id
router.get('/users/:id', validateRequest({ params: v.idParam }), controller.getUser);
// POST /admin/users/:id/suspend — Super Admin only (account-level trust & safety action)
router.post('/users/:id/suspend', requireSuperAdmin, validateRequest({ params: v.idParam }), controller.suspendUser);
// POST /admin/users/:id/unsuspend
router.post('/users/:id/unsuspend', requireSuperAdmin, validateRequest({ params: v.idParam }), controller.unsuspendUser);
// DELETE /admin/users/:id
router.delete('/users/:id', requireSuperAdmin, validateRequest({ params: v.idParam }), controller.deleteUser);

// Creators
// GET /admin/creators?page=&limit=&search=
router.get('/creators', validateRequest({ query: v.listQuery }), controller.getCreators);

// Freelancers
// GET /admin/freelancers?page=&limit=&search=
router.get('/freelancers', validateRequest({ query: v.listQuery }), controller.getFreelancers);

// Posts
// POST /admin/posts/bulk-action  { postIds, action }
router.post('/posts/bulk-action', validateRequest({ body: v.bulkPostAction }), controller.bulkModeratePosts);
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
// GET /admin/reports/sla — average pending age + resolution time
router.get('/reports/sla', controller.getReportSla);
// GET /admin/reports?page=&limit=&status=&type=
router.get('/reports', validateRequest({ query: v.reportListQuery }), controller.getReports);
// PATCH /admin/reports/:id  { status: "reviewed" | "dismissed" }
router.patch('/reports/:id', validateRequest({ params: v.idParam, body: v.reviewReport }), controller.updateReport);

// Blocks
// GET /admin/blocks?page=&limit=
router.get('/blocks', validateRequest({ query: v.blockListQuery }), controller.getBlocks);

// Subscriptions — financial data, Super Admin only
// GET /admin/subscriptions?page=&limit=&search=&status=
router.get('/subscriptions', requireSuperAdmin, validateRequest({ query: v.subscriptionListQuery }), controller.getSubscriptions);
// POST /admin/subscriptions/:id/grant — manual override, does not touch Razorpay
router.post('/subscriptions/:id/grant', requireSuperAdmin, validateRequest({ params: v.idParam }), controller.grantPremium);
// POST /admin/subscriptions/:id/revoke
router.post('/subscriptions/:id/revoke', requireSuperAdmin, validateRequest({ params: v.idParam }), controller.revokePremium);

// Categories
// GET /admin/categories?page=&limit=&search=
router.get('/categories', validateRequest({ query: v.categoryListQuery }), controller.getCategories);
// POST /admin/categories — Super Admin only (structural change, affects the whole app's taxonomy)
router.post('/categories', requireSuperAdmin, validateRequest({ body: v.createCategory }), controller.createCategory);
// PATCH /admin/categories/:id
router.patch('/categories/:id', requireSuperAdmin, validateRequest({ params: v.idParam, body: v.updateCategory }), controller.updateCategory);

// Broadcast — Super Admin only (reaches every user's device at once)
// POST /admin/broadcast  { title, body, target }
router.post('/broadcast', requireSuperAdmin, validateRequest({ body: v.broadcast }), controller.broadcast);

// Activity Logs
// GET /admin/activity-logs?page=&limit=
router.get('/activity-logs', validateRequest({ query: v.listQuery }), controller.getActivityLogs);

module.exports = router;
