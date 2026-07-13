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

// App bug/feedback from the Report Issue screen — categories mirror the
// screen's fixed issue-type cards.
const createIssueSchema = Joi.object({
  category: Joi.string().valid('Bug / Error', 'Performance', 'UI / Design', 'Account / Auth').required(),
  severity: Joi.string().valid('low', 'medium', 'high').required(),
  description: Joi.string().trim().min(1).max(2000).required(),
  screenshotUrl: Joi.string().uri().max(2000).optional(),
});

module.exports = { createReportSchema, statusQuerySchema, createIssueSchema };
