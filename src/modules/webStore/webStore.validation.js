const Joi = require('joi');

// GSTIN: 2-digit state code, 10-char PAN, entity digit, 'Z', checksum char.
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const createOrder = Joi.object({
  itemType: Joi.string().valid('PACKAGE', 'SERVICE').required(),
  itemKey: Joi.string().trim().max(60).required(),
  gstin: Joi.string().trim().uppercase().pattern(GSTIN_RE).allow('', null).optional()
    .messages({ 'string.pattern.base': 'Please enter a valid 15-character GSTIN' }),
  businessName: Joi.string().trim().max(150).allow('', null).optional(),
  email: Joi.string().trim().email({ tlds: { allow: false } }).max(150).allow('', null).optional(),
});

const verifyPayment = Joi.object({
  razorpay_order_id: Joi.string().trim().max(60).required(),
  razorpay_payment_id: Joi.string().trim().max(60).required(),
  razorpay_signature: Joi.string().trim().hex().length(64).required(),
});

const adminListQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('CREATED', 'PAID', 'FAILED').optional(),
  itemType: Joi.string().valid('PACKAGE', 'SERVICE').optional(),
  search: Joi.string().trim().max(150).allow('').optional(),
});

const adminExportQuery = adminListQuery.fork(['page', 'limit'], (s) => s.strip());

module.exports = { createOrder, verifyPayment, adminListQuery, adminExportQuery };
