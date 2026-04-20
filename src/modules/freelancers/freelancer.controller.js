const { buildProfileController } = require('../_shared/profileController');
const service = require('./freelancer.service');

module.exports = buildProfileController(service);
