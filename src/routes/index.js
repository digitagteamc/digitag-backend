const { Router } = require('express');

const authRoutes = require('../modules/auth/auth.route');
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

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, service: 'digitag-api', time: new Date().toISOString() });
});

router.use('/auth', authRoutes);
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

module.exports = router;
