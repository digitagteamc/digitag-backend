const { Router } = require('express');

const controller = require('./post.controller');
const schemas = require('./post.validation');
const { authenticate, optionalAuth } = require('../../middlewares/authMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { uploadImage } = require('../../middlewares/uploadMiddleware');
const { idParam } = require('../../validations/common.validation');

const router = Router();

const imageUploader = uploadImage({ prefix: 'posts' });

router.post(
  '/',
  authenticate,
  // Portfolio-category posts can carry up to 3 work-sample images; every
  // other post still only ever sends one, which lands in files[0].
  imageUploader.array('images', 3),
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

// Saved posts — must be before /:id so "saved" is not treated as a post ID
router.get('/saved/list', authenticate, controller.savedPosts);
router.get('/saved/ids', authenticate, controller.savedPostIds);
// Same reasoning — must be registered before the generic /:id routes below.
router.get('/boost/quota', authenticate, controller.boostQuota);

const Joi = require('joi');
const { uuid } = require('../../validations/common.validation');
const userIdParam = Joi.object({ userId: uuid.required() });

// Public: viewing someone's posts / a single post is browsing, not an account action.
router.get(
  '/user/:userId',
  optionalAuth,
  validateRequest({ params: userIdParam, query: schemas.listQuery }),
  controller.userPosts,
);

router.get('/:id', optionalAuth, validateRequest({ params: idParam }), controller.getById);
router.post('/:id/save', authenticate, validateRequest({ params: idParam }), controller.save);
router.delete('/:id/save', authenticate, validateRequest({ params: idParam }), controller.unsave);
router.post('/:id/boost', authenticate, validateRequest({ params: idParam }), controller.boost);
router.patch(
  '/:id/status',
  authenticate,
  validateRequest({ params: idParam, body: schemas.updateStatusSchema }),
  controller.updateStatus,
);

module.exports = router;
