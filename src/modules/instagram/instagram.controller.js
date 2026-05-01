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

module.exports = { startVerification, getStatus, webhookVerify, webhookReceive };
