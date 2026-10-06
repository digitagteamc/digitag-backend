const { Router } = require('express');

const c = require('./brandAdmin.controller');
const v = require('./brandAdmin.validation');
const { authenticateAdmin, requireSuperAdmin } = require('../../middlewares/adminAuthMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { idParam } = require('../../validations/common.validation');

// Admin endpoints behind the website's Brands / YouTube Channels / Ad Types /
// Celebrities pages (paths + shapes match digitag-website/lib/api.ts).
// Mounted at /admin ahead of the main admin router, so auth is per-route here
// — a router-level authenticateAdmin would also intercept /admin/login.
const router = Router();
const admin = authenticateAdmin;
const sa = [authenticateAdmin, requireSuperAdmin];

// Brands — KYC approval queue
router.get('/brands/pending', admin, validateRequest({ query: v.searchQuery }), c.listPendingBrands);
router.get('/brands', admin, validateRequest({ query: v.brandListQuery }), c.listBrands);
router.get('/brands/:id', admin, validateRequest({ params: idParam }), c.getBrand);
router.post('/brands/:id/approve', ...sa, validateRequest({ params: idParam }), c.approveBrand);
router.post('/brands/:id/reject', ...sa, validateRequest({ params: idParam, body: v.rejectBrand }), c.rejectBrand);

// YouTube channels — Brand Home "Top YouTube Channels"
router.get('/youtube-channels', admin, validateRequest({ query: v.searchQuery }), c.listYoutubeChannels);
router.post('/youtube-channels', ...sa, validateRequest({ body: v.createYoutubeChannel }), c.createYoutubeChannel);
router.patch('/youtube-channels/:id', ...sa, validateRequest({ params: idParam, body: v.updateYoutubeChannel }), c.updateYoutubeChannel);

// All channel types (TV, radio...) + channel CRM logins. No website page yet.
router.get('/channels', admin, validateRequest({ query: v.channelListQuery }), c.listChannels);
router.post('/channels', ...sa, validateRequest({ body: v.createChannel }), c.createChannel);
router.get('/channels/:id', admin, validateRequest({ params: idParam }), c.getChannel);
router.patch('/channels/:id', ...sa, validateRequest({ params: idParam, body: v.updateChannel }), c.updateChannel);
router.post('/channels/:id/users', ...sa, validateRequest({ params: idParam, body: v.createChannelUser }), c.createChannelUser);
router.patch(
  '/channels/:id/users/:userId',
  ...sa,
  validateRequest({ params: v.channelUserParams, body: v.updateChannelUser }),
  c.updateChannelUser,
);

// Ad types — Brand Home "Ad Types"
router.get('/ad-types', admin, validateRequest({ query: v.searchQuery }), c.listAdTypes);
router.post('/ad-types', ...sa, validateRequest({ body: v.createAdType }), c.createAdType);
router.patch('/ad-types/:id', ...sa, validateRequest({ params: idParam, body: v.updateAdType }), c.updateAdType);

// Celebrities — Brand Home "Celebrities"
router.get('/celebrities', admin, validateRequest({ query: v.searchQuery }), c.listCelebrities);
router.post('/celebrities', ...sa, validateRequest({ body: v.createCelebrity }), c.createCelebrity);
router.patch('/celebrities/:id', ...sa, validateRequest({ params: idParam, body: v.updateCelebrity }), c.updateCelebrity);

// Brand -> channel ad requests (read-only oversight)
router.get('/ad-requests', admin, validateRequest({ query: v.adRequestListQuery }), c.listAdRequests);

module.exports = router;
