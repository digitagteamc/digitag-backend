const { Router } = require('express');
const { createRateLimiter } = require('../../utils/rateLimiter');

const c = require('./celebrityApplication.controller');
const v = require('./celebrityApplication.validation');
const { authenticateAdmin, requireSuperAdmin } = require('../../middlewares/adminAuthMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');

// Public: the website's Celebrity panel (no account — open write endpoint,
// so rate-limited per IP).
const publicRouter = Router();

const submitLimiter = createRateLimiter('celebrity-onboarding', {
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many attempts. Try again later.' },
});

publicRouter.post('/', submitLimiter, validateRequest({ body: v.submitOnboarding }), c.submitOnboarding);

// Admin review queue. Mounted at /admin ahead of the main admin router, so
// auth is per-route (a router-level authenticateAdmin would catch /admin/login).
const adminRouter = Router();
const sa = [authenticateAdmin, requireSuperAdmin];

adminRouter.get('/celebrity-applications', authenticateAdmin, validateRequest({ query: v.listQuery }), c.list);
adminRouter.get('/celebrity-applications/:id', authenticateAdmin, validateRequest({ params: v.idParam }), c.get);
adminRouter.post('/celebrity-applications/:id/approve', ...sa, validateRequest({ params: v.idParam }), c.approve);
adminRouter.post(
  '/celebrity-applications/:id/reject',
  ...sa,
  validateRequest({ params: v.idParam, body: v.reject }),
  c.reject,
);

module.exports = { publicRouter, adminRouter };
