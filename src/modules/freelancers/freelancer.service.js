const { buildProfileService } = require('../_shared/profileService');
const { ROLES } = require('../../constants/roles');

module.exports = buildProfileService({
  model: 'freelancerProfile',
  role: ROLES.FREELANCER,
});
