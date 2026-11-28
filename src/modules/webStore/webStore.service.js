/* global Buffer */
const crypto = require('crypto');
const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');
const razorpay = require('../../config/razorpay');
const env = require('../../config/env');
const logger = require('../../utils/logger');
const catalog = require('./webStore.catalog');

const DAY_MS = 24 * 60 * 60 * 1000;

function safeEqualHex(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function requireRazorpay() {
  if (!env.RAZORPAY.keyId || !env.RAZORPAY.keySecret) {
    throw ApiError.internal('Payments are not configured');
  }
}

/** Name/email/phone to pre-fill Razorpay Checkout and to snapshot on the purchase. */
async function customerDetails(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      mobileNumber: true,
      countryCode: true,
      creatorProfile: { select: { name: true, email: true } },
      freelancerProfile: { select: { name: true, email: true } },
    },
  });
  const profile = user?.creatorProfile || user?.freelancerProfile || {};
  return {
    name: profile.name || null,
    email: profile.email || null,
    phone: user ? `${user.countryCode || '+91'}${user.mobileNumber}` : '',
  };
}

async function createOrder(user, body) {
  const q = catalog.quote(body.itemType, body.itemKey);
  if (!q) throw ApiError.badRequest('That item is not available');
  requireRazorpay();

  const customer = await customerDetails(user.id);
  const email = body.email || customer.email;

  const order = await razorpay.orders.create({
    amount: q.totalAmount,
    currency: q.currency,
    // Receipt is ours, shown in the Razorpay dashboard; max 40 chars.
    receipt: `web_${q.itemKey}_${Date.now().toString(36)}`.slice(0, 40),
    notes: { source: 'website', userId: user.id, itemType: q.itemType, itemKey: q.itemKey },
  });

  const purchase = await prisma.webPurchase.create({
    data: {
      userId: user.id,
      itemType: q.itemType,
      itemKey: q.itemKey,
      itemName: q.itemName,
      baseAmount: q.baseAmount,
      gstAmount: q.gstAmount,
      totalAmount: q.totalAmount,
      currency: q.currency,
      razorpayOrderId: order.id,
      gstin: body.gstin || null,
      businessName: body.businessName || null,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: email || null,
    },
    select: { id: true },
  });

  return {
    purchaseId: purchase.id,
    orderId: order.id,
    keyId: env.RAZORPAY.keyId,
    ...q,
    prefill: { name: customer.name || '', email: email || '', contact: customer.phone },
  };
}

/**
 * Marks a purchase paid exactly once (the browser callback and the webhook can
 * both arrive). Packages get a 30-day period that starts when the buyer's
 * current package ends, so renewing early never loses days.
 */
async function markPaid(purchase, paymentId) {
  return prisma.$transaction(async (tx) => {
    let periodStart = null;
    let periodEnd = null;
    if (purchase.itemType === 'PACKAGE') {
      const now = new Date();
      const running = await tx.webPurchase.findFirst({
        where: { userId: purchase.userId, itemType: 'PACKAGE', status: 'PAID', periodEnd: { gt: now } },
        orderBy: { periodEnd: 'desc' },
        select: { periodEnd: true },
      });
      periodStart = running ? running.periodEnd : now;
      periodEnd = new Date(periodStart.getTime() + catalog.PACKAGE_DAYS * DAY_MS);
    }
    const { count } = await tx.webPurchase.updateMany({
      where: { id: purchase.id, status: { not: 'PAID' } },
      data: { status: 'PAID', razorpayPaymentId: paymentId, paidAt: new Date(), periodStart, periodEnd },
    });
    if (count === 0) logger.info('[web-store] purchase already marked paid', { id: purchase.id });
    return tx.webPurchase.findUnique({ where: { id: purchase.id } });
  });
}

/** Captures an authorized payment if the account doesn't auto-capture. */
async function ensureCaptured(paymentId, purchase) {
  const payment = await razorpay.payments.fetch(paymentId);
  if (payment.order_id !== purchase.razorpayOrderId) throw ApiError.badRequest('Payment does not match this order');
  if (Number(payment.amount) !== purchase.totalAmount) throw ApiError.badRequest('Payment amount does not match');
  if (payment.status === 'authorized') {
    await razorpay.payments.capture(paymentId, purchase.totalAmount, purchase.currency);
  } else if (payment.status !== 'captured') {
    throw ApiError.badRequest(`Payment is ${payment.status}`);
  }
}

async function verifyPayment(user, body) {
  requireRazorpay();
  const purchase = await prisma.webPurchase.findUnique({ where: { razorpayOrderId: body.razorpay_order_id } });
  if (!purchase || purchase.userId !== user.id) throw ApiError.notFound('Order not found');
  if (purchase.status === 'PAID') return shape(purchase);

  // Razorpay Checkout signature: HMAC-SHA256(order_id|payment_id, key_secret).
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY.keySecret)
    .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`)
    .digest('hex');
  if (!safeEqualHex(expected, body.razorpay_signature)) throw ApiError.badRequest('Payment verification failed');

  await ensureCaptured(body.razorpay_payment_id, purchase);
  return shape(await markPaid(purchase, body.razorpay_payment_id));
}

/**
 * Razorpay webhook (payment.captured / order.paid) — the safety net for when
 * the buyer closes the tab before the browser callback reaches us. Returns
 * true when the event belonged to a website purchase.
 */
async function handleRazorpayEvent(payload) {
  const event = payload?.event;
  if (event !== 'payment.captured' && event !== 'order.paid') return false;
  const payment = payload?.payload?.payment?.entity;
  const orderId = payment?.order_id || payload?.payload?.order?.entity?.id;
  if (!orderId || !payment?.id) return false;

  const purchase = await prisma.webPurchase.findUnique({ where: { razorpayOrderId: orderId } });
  if (!purchase) return false;
  if (Number(payment.amount) !== purchase.totalAmount) {
    logger.error('[web-store webhook] amount mismatch', { orderId, paid: payment.amount, expected: purchase.totalAmount });
    return true;
  }
  if (purchase.status !== 'PAID') await markPaid(purchase, payment.id);
  return true;
}

function shape(p) {
  return {
    id: p.id,
    itemType: p.itemType,
    itemKey: p.itemKey,
    itemName: p.itemName,
    baseAmount: p.baseAmount,
    gstAmount: p.gstAmount,
    totalAmount: p.totalAmount,
    currency: p.currency,
    status: p.status,
    periodStart: p.periodStart,
    periodEnd: p.periodEnd,
    paidAt: p.paidAt,
    razorpayPaymentId: p.razorpayPaymentId,
  };
}

async function myPurchases(userId) {
  const rows = await prisma.webPurchase.findMany({
    where: { userId, status: 'PAID' },
    orderBy: { paidAt: 'desc' },
    take: 50,
  });
  const now = new Date();
  const activePackage = rows
    .filter((r) => r.itemType === 'PACKAGE' && r.periodStart && r.periodEnd && r.periodStart <= now && r.periodEnd > now)
    .map(shape)[0] || null;
  return { activePackage, purchases: rows.map(shape) };
}

// ─── Admin ──────────────────────────────────────────────────────────────────

function adminWhere(query = {}) {
  const where = {};
  if (query.status) where.status = query.status;
  if (query.itemType) where.itemType = query.itemType;
  if (query.search) {
    const contains = { contains: query.search, mode: 'insensitive' };
    where.OR = [
      { customerName: contains },
      { customerPhone: contains },
      { customerEmail: contains },
      { itemName: contains },
      { razorpayOrderId: contains },
      { razorpayPaymentId: contains },
      { gstin: contains },
    ];
  }
  return where;
}

async function adminList(query = {}) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = adminWhere(query);
  const [items, total] = await Promise.all([
    prisma.webPurchase.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.webPurchase.count({ where }),
  ]);
  return { items, meta: buildPaginationMeta({ total, page, limit }) };
}

const rupees = (paise) => (paise / 100).toFixed(2);
const ist = (d) => (d ? d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '');

const COLUMNS = [
  { label: 'Created (IST)', get: (r) => ist(r.createdAt) },
  { label: 'Status', get: (r) => r.status },
  { label: 'Type', get: (r) => r.itemType },
  { label: 'Item', get: (r) => r.itemName },
  { label: 'Base (₹)', get: (r) => rupees(r.baseAmount) },
  { label: 'GST (₹)', get: (r) => rupees(r.gstAmount) },
  { label: 'Total (₹)', get: (r) => rupees(r.totalAmount) },
  { label: 'Customer', get: (r) => r.customerName },
  { label: 'Phone', get: (r) => r.customerPhone },
  { label: 'Email', get: (r) => r.customerEmail },
  { label: 'GSTIN', get: (r) => r.gstin },
  { label: 'Business Name', get: (r) => r.businessName },
  { label: 'Paid (IST)', get: (r) => ist(r.paidAt) },
  { label: 'Period Start (IST)', get: (r) => ist(r.periodStart) },
  { label: 'Period End (IST)', get: (r) => ist(r.periodEnd) },
  { label: 'Razorpay Order', get: (r) => r.razorpayOrderId },
  { label: 'Razorpay Payment', get: (r) => r.razorpayPaymentId },
];

// UTF-8 BOM so Excel shows ₹ correctly; formula-looking values neutralised.
async function adminExportCsv(query = {}) {
  const rows = await prisma.webPurchase.findMany({ where: adminWhere(query), orderBy: { createdAt: 'desc' } });
  const escape = (v) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = COLUMNS.map((c) => c.label).join(',');
  const body = rows.map((r) => COLUMNS.map((c) => escape(c.get(r))).join(',')).join('\r\n');
  return `﻿${header}\r\n${body}`;
}

module.exports = {
  createOrder,
  verifyPayment,
  handleRazorpayEvent,
  myPurchases,
  adminList,
  adminExportCsv,
};
