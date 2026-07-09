const crypto = require('crypto');
const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const razorpay = require('../../config/razorpay');
const env = require('../../config/env');
const logger = require('../../utils/logger');

// Razorpay's subscription statuses are already lowercase versions of our enum
// (created/authenticated/active/pending/halted/cancelled/completed/expired).
function toLocalStatus(razorpayStatus) {
  return String(razorpayStatus || '').toUpperCase();
}

function toDate(unixSeconds) {
  return unixSeconds ? new Date(unixSeconds * 1000) : null;
}

async function createSubscription(user) {
  const existing = await prisma.subscription.findUnique({ where: { userId: user.id } });
  if (existing && existing.status === 'ACTIVE') {
    throw ApiError.conflict('You already have an active subscription');
  }

  // Monthly plan, billed for 12 cycles then auto-renews the subscription entity
  // itself is still active — Razorpay requires a total_count up front.
  const razorpaySub = await razorpay.subscriptions.create({
    plan_id: env.RAZORPAY.planId,
    customer_notify: 1,
    total_count: 12,
    notes: { userId: user.id },
  });

  const subscription = await prisma.subscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      razorpaySubscriptionId: razorpaySub.id,
      razorpayPlanId: env.RAZORPAY.planId,
      status: toLocalStatus(razorpaySub.status) || 'CREATED',
    },
    update: {
      razorpaySubscriptionId: razorpaySub.id,
      razorpayPlanId: env.RAZORPAY.planId,
      status: toLocalStatus(razorpaySub.status) || 'CREATED',
    },
  });

  return {
    subscriptionId: subscription.razorpaySubscriptionId,
    keyId: env.RAZORPAY.keyId,
  };
}

async function getMySubscription(userId) {
  const [subscription, user] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { isPremium: true } }),
  ]);
  return {
    isPremium: Boolean(user?.isPremium),
    subscription: subscription
      ? {
          status: subscription.status,
          currentStart: subscription.currentStart,
          currentEnd: subscription.currentEnd,
        }
      : null,
  };
}

function verifyWebhookSignature(rawBody, signature) {
  if (!env.RAZORPAY.webhookSecret || !signature) return false;
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY.webhookSecret)
    .update(rawBody)
    .digest('hex');
  // Constant-time compare — both sides must be equal length or timingSafeEqual throws.
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function handleWebhookEvent(payload) {
  const entity = payload?.payload?.subscription?.entity;
  if (!entity?.id) return;

  const status = toLocalStatus(entity.status);
  const data = {
    status,
    currentStart: toDate(entity.current_start),
    currentEnd: toDate(entity.current_end),
  };

  const subscription = await prisma.subscription.findUnique({
    where: { razorpaySubscriptionId: entity.id },
  });
  if (!subscription) {
    // Webhook arrived before/without a local record (e.g. subscription created directly
    // in the Razorpay dashboard) — nothing to reconcile against, so just log and skip.
    logger.warn('[razorpay webhook] no local subscription for', { id: entity.id });
    return;
  }

  await prisma.subscription.update({ where: { id: subscription.id }, data });
  await prisma.user.update({
    where: { id: subscription.userId },
    data: { isPremium: status === 'ACTIVE' },
  });
}

module.exports = { createSubscription, getMySubscription, verifyWebhookSignature, handleWebhookEvent };
