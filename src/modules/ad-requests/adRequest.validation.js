const Joi = require('joi');
const { uuid, pagination } = require('../../validations/common.validation');

const STATUSES = ['PENDING', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'IN_PROGRESS', 'COMPLETED'];

const createSchema = Joi.object({
  channelId: uuid.required(),
  campaignName: Joi.string().trim().max(150).allow('', null).optional(),
  brief: Joi.string().trim().max(3000).allow('', null).optional(),
  startDate: Joi.date().iso().allow(null).optional(),
  endDate: Joi.date().iso().allow(null).optional(),
  budget: Joi.number().min(0).precision(2).allow(null).optional(),
  items: Joi.array()
    .items(
      Joi.object({
        catalogItemId: uuid.required(),
        quantity: Joi.number().integer().min(1).max(100000).required(),
        notes: Joi.string().trim().max(500).allow('', null).optional(),
      }),
    )
    .min(1)
    .max(50)
    .unique('catalogItemId')
    .required(),
});

const listQuery = pagination.keys({
  status: Joi.string().valid(...STATUSES).optional(),
  channelId: uuid.optional(),
});

const cancelSchema = Joi.object({
  note: Joi.string().trim().max(1000).allow('', null).optional(),
});

const noteSchema = Joi.object({
  note: Joi.string().trim().min(1).max(2000).required(),
});

module.exports = { STATUSES, createSchema, listQuery, cancelSchema, noteSchema };
