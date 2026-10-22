const { Router } = require('express');
const { createRateLimiter } = require('../../utils/rateLimiter');

const controller = require('./crm.controller');
const v = require('./crm.validation');
const { authenticateChannelUser, requireChannelOwner } = require('../../middlewares/crmAuthMiddleware');
const { validateRequest } = require('../../middlewares/validateMiddleware');
const { idParam } = require('../../validations/common.validation');

// Backend for the TV / YouTube channel CRM. Every route below login is
// scoped to the logged-in ChannelUser's own channel.
const router = Router();

const loginLimiter = createRateLimiter('crm-login', {
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Try again later.' },
});

router.post('/login', loginLimiter, validateRequest({ body: v.login }), controller.login);

router.use(authenticateChannelUser);

// Account + channel profile
router.get('/me', controller.me);
router.post('/password', validateRequest({ body: v.changePassword }), controller.changePassword);
router.put('/channel', requireChannelOwner, validateRequest({ body: v.updateChannel }), controller.updateChannel);

// Team (owner only)
router.get('/team', requireChannelOwner, controller.listTeam);
router.post('/team', requireChannelOwner, validateRequest({ body: v.createTeamMember }), controller.createTeamMember);
router.patch('/team/:id', requireChannelOwner, validateRequest({ params: idParam, body: v.updateTeamMember }), controller.updateTeamMember);

// Ad requests from brands
router.get('/stats', controller.stats);
router.get('/ad-requests', validateRequest({ query: v.adRequestListQuery }), controller.listAdRequests);
router.get('/ad-requests/:id', validateRequest({ params: idParam }), controller.getAdRequest);
router.patch('/ad-requests/:id/status', validateRequest({ params: idParam, body: v.updateStatus }), controller.updateAdRequestStatus);
router.post('/ad-requests/:id/notes', validateRequest({ params: idParam, body: v.note }), controller.addNote);

// Catalog / rate card
router.get('/ad-types', controller.adTypes);
router.get('/catalog', validateRequest({ query: v.catalogQuery }), controller.listCatalog);
router.post('/catalog', validateRequest({ body: v.createCatalogItem }), controller.createCatalogItem);
router.put('/catalog/:id', validateRequest({ params: idParam, body: v.updateCatalogItem }), controller.updateCatalogItem);
router.delete('/catalog/:id', validateRequest({ params: idParam }), controller.archiveCatalogItem);

// Showcase — past brand collaborations shown on the channel's profile
router.get('/showcase', controller.listShowcase);
router.post('/showcase', validateRequest({ body: v.createShowcase }), controller.createShowcase);
router.put('/showcase/:id', validateRequest({ params: idParam, body: v.updateShowcase }), controller.updateShowcase);
router.delete('/showcase/:id', validateRequest({ params: idParam }), controller.deleteShowcase);

// Direct-to-S3 uploads for logos, demo ad videos and showcase media
router.post('/uploads/presigned', validateRequest({ body: v.presignUpload }), controller.presignUpload);

module.exports = router;
