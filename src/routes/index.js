const { Router } = require('express');

const authRoutes = require('../modules/auth/auth.route');
const adminRoutes = require('../modules/admin/admin.route');
const categoryRoutes = require('../modules/categories/category.route');
const userRoutes = require('../modules/users/user.route');
const creatorRoutes = require('../modules/creators/creator.route');
const freelancerRoutes = require('../modules/freelancers/freelancer.route');
const postRoutes = require('../modules/posts/post.route');
const feedRoutes = require('../modules/feeds/feed.route');
const uploadRoutes = require('../modules/uploads/upload.route');
const collaborationRoutes = require('../modules/collaborations/collaboration.route');
const conversationRoutes = require('../modules/conversations/conversation.route');
const followRoutes = require('../modules/follows/follow.route');
const blockRoutes = require('../modules/blocks/block.route');
const reportRoutes = require('../modules/reports/report.route');
const searchRoutes = require('../modules/search/search.route');
const instagramRoutes = require('../modules/instagram/instagram.route');
const socialVerificationRoutes = require('../modules/social-verifications/socialVerification.route');
const callRoutes = require('../modules/calls/calls.route');
const subscriptionRoutes = require('../modules/subscriptions/subscription.route');
const subscriptionWebhookRoutes = require('../modules/subscriptions/subscription.webhook.route');
const notificationRoutes = require('../modules/notifications/notification.route');
const waitlistRoutes = require('../modules/waitlist/waitlist.route');

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, service: 'digitag-api', time: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/categories', categoryRoutes);
router.use('/users', userRoutes);
router.use('/creators', creatorRoutes);
router.use('/freelancers', freelancerRoutes);
router.use('/posts', postRoutes);
router.use('/feed', feedRoutes);
router.use('/uploads', uploadRoutes);
router.use('/collaborations', collaborationRoutes);
router.use('/conversations', conversationRoutes);
router.use('/follows', followRoutes);
router.use('/blocks', blockRoutes);
router.use('/reports', reportRoutes);
router.use('/search', searchRoutes);
router.use('/instagram', instagramRoutes);
router.use('/social-verifications', socialVerificationRoutes);
router.use('/calls', callRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/webhooks', subscriptionWebhookRoutes);
router.use('/notifications', notificationRoutes);
router.use('/waitlist', waitlistRoutes);

module.exports = router;
