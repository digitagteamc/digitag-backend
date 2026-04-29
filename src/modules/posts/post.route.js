const { Router } = require('express');

const controller = require('./post.controller');
const schemas = require('./post.validation');
const { authenticate } = require('../../middlewares/authMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { uploadImage } = require('../../middlewares/uploadMiddleware');
const { idParam } = require('../../validations/common.validation');

const router = Router();

const imageUploader = uploadImage({ prefix: 'posts' });

router.post(
  '/',
  authenticate,
  imageUploader.single('image'),
  validateRequest({ body: schemas.createPostSchema }),
  controller.create,
);

router.put(
  '/:id',
  authenticate,
  imageUploader.single('image'),
  validateRequest({ params: idParam, body: schemas.updatePostSchema }),
  controller.update,
);

router.delete(
  '/:id',
  authenticate,
  validateRequest({ params: idParam }),
  controller.remove,
);

router.get('/me', authenticate, validateRequest({ query: schemas.listQuery }), controller.myPosts);

const Joi = require('joi');
const { uuid } = require('../../validations/common.validation');
const userIdParam = Joi.object({ userId: uuid.required() });

router.get(
  '/user/:userId',
  authenticate,
  validateRequest({ params: userIdParam, query: schemas.listQuery }),
  controller.userPosts,
);

router.get('/:id', authenticate, validateRequest({ params: idParam }), controller.getById);

module.exports = router;
