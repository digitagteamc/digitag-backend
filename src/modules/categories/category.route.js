const { Router } = require('express');
const Joi = require('joi');

const controller = require('./category.controller');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { ROLE_VALUES } = require('../../constants/roles');
const { idParam } = require('../../validations/common.validation');

const router = Router();

const listQuery = Joi.object({
  role: Joi.string().valid(...ROLE_VALUES).optional(),
  search: Joi.string().trim().max(100).optional(),
}).unknown(true);

router.get('/', validateRequest({ query: listQuery }), controller.list);
router.get('/:id', validateRequest({ params: idParam }), controller.getById);

module.exports = router;
