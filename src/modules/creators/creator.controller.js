const { buildProfileController } = require('../_shared/profileController');
const service = require('./creator.service');

module.exports = buildProfileController(service);
