const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const MESSAGES = require('../../constants/messages');
const STATUS = require('../../constants/statusCodes');
const service = require('./post.service');
const uploadService = require('../uploads/upload.service');

async function attachUploadedImage(req) {
  if (!req.file) return;
  const { key, url } = await uploadService.handleImageUpload(req.file, {
    prefix: `posts/${req.user.id}`,
  });
  req.body.imageKey = key;
  req.body.imageUrl = url;
}

const create = asyncHandler(async (req, res) => {
  await attachUploadedImage(req);
  const data = await service.createPost(req.user, req.body);
  return success(res, { statusCode: STATUS.CREATED, message: MESSAGES.POST.CREATED, data });
});

const update = asyncHandler(async (req, res) => {
  await attachUploadedImage(req);
  const data = await service.updatePost(req.user, req.params.id, req.body);
  return success(res, { message: MESSAGES.POST.UPDATED, data });
});

const remove = asyncHandler(async (req, res) => {
  await service.deletePost(req.user, req.params.id);
  return success(res, { message: MESSAGES.POST.DELETED });
});

const getById = asyncHandler(async (req, res) => {
  const data = await service.getPostById(req.params.id);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data });
});

const myPosts = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listMyPosts(req.user, req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
});

const userPosts = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listUserPosts(req.params.userId, req.query);
  return success(res, { message: MESSAGES.GENERIC.FETCHED, data: items, meta });
});

module.exports = { create, update, remove, getById, myPosts, userPosts };
