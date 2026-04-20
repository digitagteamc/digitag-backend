const { Router } = require('express');
const Joi = require('joi');

const controller = require('./upload.controller');
const { authenticate } = require('../../middlewares/authMiddleware');
const { uploadImage } = require('../../middlewares/uploadMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');

const router = Router();

const presignedBody = Joi.object({
  originalName: Joi.string().max(255).required(),
  mimeType: Joi.string().valid('image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif').required(),
  prefix: Joi.string().max(120).optional(),
});

router.post(
  '/image',
  authenticate,
  uploadImage({ prefix: 'uploads' }).single('image'),
  controller.uploadImage,
);

router.post(
  '/presigned',
  authenticate,
  validateRequest({ body: presignedBody }),
  controller.presignedUpload,
);

module.exports = router;
