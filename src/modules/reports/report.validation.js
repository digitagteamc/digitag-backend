const Joi = require('joi');
const { uuid } = require('../../validations/common.validation');

const REPORT_TYPES = ['USER', 'POST'];

const createReportSchema = Joi.object({
  type: Joi.string().valid(...REPORT_TYPES).required(),
  targetId: uuid.required(),
  targetName: Joi.string().trim().min(1).max(200).required(),
  reason: Joi.string().trim().min(1).max(500).required(),
});

const statusQuerySchema = Joi.object({
  type: Joi.string().valid(...REPORT_TYPES).required(),
  targetId: uuid.required(),
});

module.exports = { createReportSchema, statusQuerySchema };
