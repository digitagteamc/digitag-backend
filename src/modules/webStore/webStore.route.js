const { Router } = require('express');
const rateLimit = require('express-rate-limit');

const service = require('./webStore.service');
const catalog = require('./webStore.catalog');
const schemas = require('./webStore.validation');
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate } = require('../../middlewares/authMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');

// Each order hits Razorpay's API, so cap how fast one client can create them.
const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, try again shortly.' },
});

const router = Router();

// GET /web-store/catalog — public prices incl. GST, for the checkout summary.
router.get('/catalog', (_req, res) => success(res, { message: 'Fetched successfully', data: catalog.catalog() }));

// POST /web-store/orders { itemType, itemKey, gstin?, businessName?, email? } → Razorpay order for Checkout
router.post(
  '/orders',
  authenticate,
  orderLimiter,
  validateRequest({ body: schemas.createOrder }),
  asyncHandler(async (req, res) => {
    const data = await service.createOrder(req.user, req.body);
    return success(res, { statusCode: 201, message: 'Order created', data });
  }),
);

// POST /web-store/orders/verify — Checkout's handler response; marks the purchase paid.
router.post(
  '/orders/verify',
  authenticate,
  validateRequest({ body: schemas.verifyPayment }),
  asyncHandler(async (req, res) => {
    const data = await service.verifyPayment(req.user, req.body);
    return success(res, { message: 'Payment successful', data });
  }),
);

// GET /web-store/purchases/me — the buyer's paid purchases + running package.
router.get(
  '/purchases/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const data = await service.myPurchases(req.user.id);
    return success(res, { message: 'Fetched successfully', data });
  }),
);

module.exports = router;
