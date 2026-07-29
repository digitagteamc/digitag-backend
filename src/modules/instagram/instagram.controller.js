const crypto = require('crypto');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const STATUS = require('../../constants/statusCodes');
const service = require('./instagram.service');
const env = require('../../config/env');

const startVerification = asyncHandler(async (req, res) => {
  const data = await service.startVerification(req.user.id, req.body.instagramUrl);
  return success(res, { statusCode: STATUS.CREATED, message: 'Verification started', data });
});

const getStatus = asyncHandler(async (req, res) => {
  const data = await service.getVerificationStatus(req.user.id, req.params.id);
  return success(res, { message: 'Status fetched', data });
});

const listAccounts = asyncHandler(async (req, res) => {
  const data = await service.listAccounts(req.user.id);
  return success(res, { message: 'Accounts fetched', data });
});

const removeAccount = asyncHandler(async (req, res) => {
  await service.removeAccount(req.user.id, req.params.id);
  return success(res, { message: 'Account removed' });
});

const getReusableAccount = asyncHandler(async (req, res) => {
  const data = await service.getReusableAccount(req.user.id);
  return success(res, { message: 'Reusable account fetched', data });
});

const reuseAccount = asyncHandler(async (req, res) => {
  const data = await service.reuseVerifiedAccount(req.user.id, req.body.instagramUsername);
  return success(res, { message: 'Instagram account linked', data });
});

// Meta webhook challenge-response (GET)
const webhookVerify = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === env.INSTAGRAM_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ success: false, message: 'Verification token mismatch' });
};

// Meta webhook event receiver (POST)
const webhookReceive = asyncHandler(async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  if (!service.verifyWebhookSignature(req.rawBody, signature)) {
    console.log('[Instagram] Webhook signature missing/invalid — rejecting');
    return res.status(401).json({ success: false, message: 'Invalid signature' });
  }

  // Always respond 200 immediately — Meta retries if we don't
  res.status(200).json({ success: true });

  // Process DMs asynchronously after responding
  const entries = req.body?.entry ?? [];
  for (const entry of entries) {
    for (const event of entry.messaging ?? []) {
      const senderId = event.sender?.id;
      const text = event.message?.text;
      if (senderId && text) {
        service.handleWebhookMessage(senderId, text).catch(() => {});
      }
    }
  }
});

module.exports = { startVerification, getStatus, listAccounts, removeAccount, getReusableAccount, reuseAccount, webhookVerify, webhookReceive };
