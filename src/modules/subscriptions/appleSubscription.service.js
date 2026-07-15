const fs = require('fs');
const path = require('path');
const {
  AppStoreServerAPIClient,
  SignedDataVerifier,
  Environment,
} = require('@apple/app-store-server-library');
const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const env = require('../../config/env');
const logger = require('../../utils/logger');

const APPLE_ROOT_CA = fs.readFileSync(path.join(__dirname, '../../config/certs/AppleRootCA-G3.cer'));

function configured() {
  return Boolean(env.APPLE.issuerId && env.APPLE.keyId && env.APPLE.privateKey && env.APPLE.bundleId);
}

function appleEnvironment() {
  return env.APPLE.sandbox ? Environment.SANDBOX : Environment.PRODUCTION;
}

function apiClient() {
  return new AppStoreServerAPIClient(
    env.APPLE.privateKey.replace(/\\n/g, '\n'),
    env.APPLE.keyId,
    env.APPLE.issuerId,
    env.APPLE.bundleId,
    appleEnvironment(),
  );
}

function verifier() {
  // appAppleId is omitted — Apple's docs say it's only required in the
  // PRODUCTION environment, but since it's just an extra identity check and
  // we don't have it configured, sandbox-only verification is fine for now.
  return new SignedDataVerifier([APPLE_ROOT_CA], true, appleEnvironment(), env.APPLE.bundleId);
}

// A transaction's Apple-side status is derived, not a field on the payload
// itself: revoked (refunded/revoked by Apple) beats everything else, then
// whether expiresDate has passed.
function statusFromTransaction(tx) {
  if (tx.revocationDate) return 'CANCELLED';
  if (tx.expiresDate && tx.expiresDate < Date.now()) return 'EXPIRED';
  return 'ACTIVE';
}

async function upsertFromDecodedTransaction(userId, tx) {
  // A transaction belongs to exactly one Apple ID — if its originalTransactionId
  // is already on file for a DIFFERENT user, someone is replaying another
  // account's purchase. Reject rather than silently handing out Premium.
  const existing = await prisma.subscription.findUnique({
    where: { appleOriginalTransactionId: String(tx.originalTransactionId) },
  });
  if (existing && existing.userId !== userId) {
    throw ApiError.conflict('This purchase is already linked to a different account');
  }

  const status = statusFromTransaction(tx);
  const data = {
    provider: 'APPLE',
    appleOriginalTransactionId: String(tx.originalTransactionId),
    appleTransactionId: String(tx.transactionId),
    appleProductId: tx.productId,
    status,
    currentStart: tx.purchaseDate ? new Date(tx.purchaseDate) : null,
    currentEnd: tx.expiresDate ? new Date(tx.expiresDate) : null,
  };

  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  await prisma.user.update({ where: { id: userId }, data: { isPremium: status === 'ACTIVE' } });
  return status;
}

/** Called right after a successful StoreKit purchase — the app hands us the
 *  transactionId react-native-iap gave it; we ask Apple's own servers for
 *  the authoritative signed record rather than trusting anything the client
 *  sent about price/product/dates directly. */
async function verifyPurchase(userId, transactionId) {
  if (!configured()) throw ApiError.internal('Apple In-App Purchase is not configured yet');
  if (!transactionId) throw ApiError.badRequest('transactionId is required');

  let info;
  try {
    info = await apiClient().getTransactionInfo(transactionId);
  } catch (err) {
    // APIException's useful detail lives in errorMessage/httpStatusCode, not
    // .message (which is empty) — log those or every real failure shows up
    // as an unhelpful blank string.
    logger.error('[apple iap] getTransactionInfo failed', {
      httpStatusCode: err.httpStatusCode,
      errorMessage: err.errorMessage,
      errorCode: err.errorCode,
    });
    throw ApiError.badRequest('Could not verify this purchase with Apple');
  }

  let tx;
  try {
    tx = await verifier().verifyAndDecodeTransaction(info.signedTransactionInfo);
  } catch (err) {
    logger.error('[apple iap] transaction verification failed', { err: err.message });
    throw ApiError.badRequest('Purchase verification failed');
  }

  const status = await upsertFromDecodedTransaction(userId, tx);
  return { status, isPremium: status === 'ACTIVE' };
}

/** App Store Server Notifications V2 — Apple POSTs this whenever a
 *  subscription's state changes on its own (renewal, cancellation, refund,
 *  billing retry, etc), independent of the app being open. Keeps isPremium
 *  correct without the user ever having to reopen the app. */
async function handleNotification(signedPayload) {
  if (!configured()) return;

  const decoded = await verifier().verifyAndDecodeNotification(signedPayload);
  const signedTransactionInfo = decoded?.data?.signedTransactionInfo;
  if (!signedTransactionInfo) {
    logger.warn('[apple iap] notification with no transaction info', { type: decoded?.notificationType });
    return;
  }

  const tx = await verifier().verifyAndDecodeTransaction(signedTransactionInfo);
  const subscription = await prisma.subscription.findUnique({
    where: { appleOriginalTransactionId: String(tx.originalTransactionId) },
  });
  if (!subscription) {
    // Notification arrived before we ever saw this transaction (e.g. a
    // renewal notification racing the initial verifyPurchase call) — nothing
    // local to reconcile against yet, skip; the next notification or the
    // user reopening the app will catch it up.
    logger.warn('[apple iap] no local subscription for', { originalTransactionId: tx.originalTransactionId });
    return;
  }

  await upsertFromDecodedTransaction(subscription.userId, tx);
}

module.exports = { verifyPurchase, handleNotification, configured };
