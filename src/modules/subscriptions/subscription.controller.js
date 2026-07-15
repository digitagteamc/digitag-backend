const asyncHandler = require('../../utils/asyncHandler');
const { success, ApiError } = require('../../utils/apiResponse');
const STATUS = require('../../constants/statusCodes');
const logger = require('../../utils/logger');
const service = require('./subscription.service');
const appleService = require('./appleSubscription.service');

const create = asyncHandler(async (req, res) => {
  const data = await service.createSubscription(req.user);
  return success(res, { statusCode: STATUS.CREATED, message: 'Subscription created', data });
});

const me = asyncHandler(async (req, res) => {
  const data = await service.getMySubscription(req.user.id);
  return success(res, { message: 'Fetched successfully', data });
});

// Razorpay expects a 200 for any event it delivered successfully, regardless of what
// we did with it, or it will keep retrying. Only signature failures get rejected.
const webhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const valid = service.verifyWebhookSignature(req.rawBody, signature);
  if (!valid) throw ApiError.unauthorized('Invalid webhook signature');

  try {
    await service.handleWebhookEvent(req.body);
  } catch (err) {
    logger.error('[razorpay webhook] handling failed', { err: err.message });
  }
  return res.status(STATUS.OK).json({ success: true });
});

const verifyApple = asyncHandler(async (req, res) => {
  const data = await appleService.verifyPurchase(req.user.id, req.body.transactionId);
  return success(res, { message: 'Purchase verified', data });
});

// Apple retries notifications that don't get a 2xx, same as Razorpay's
// webhook above — swallow handling errors after logging so a transient issue
// (e.g. our DB being briefly unavailable) doesn't cause a notification storm.
const appleWebhook = asyncHandler(async (req, res) => {
  try {
    await appleService.handleNotification(req.body.signedPayload);
  } catch (err) {
    logger.error('[apple webhook] handling failed', { err: err.message });
  }
  return res.status(STATUS.OK).json({ success: true });
});

module.exports = { create, me, webhook, verifyApple, appleWebhook };
