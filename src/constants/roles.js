const ROLES = Object.freeze({
  CREATOR: 'CREATOR',
  FREELANCER: 'FREELANCER',
  BRAND: 'BRAND',
  AGENCY: 'AGENCY',
  ADMIN: 'ADMIN',
});

const ROLE_VALUES = Object.values(ROLES);

const PUBLIC_SIGNUP_ROLES = [ROLES.CREATOR, ROLES.FREELANCER, ROLES.BRAND];

const OPPOSITE_FEED_ROLE = Object.freeze({
  [ROLES.CREATOR]: [ROLES.FREELANCER],
  [ROLES.FREELANCER]: [ROLES.CREATOR],
  [ROLES.BRAND]: [ROLES.CREATOR, ROLES.FREELANCER],
  [ROLES.AGENCY]: [ROLES.CREATOR, ROLES.FREELANCER],
});

// Who a collaboration request may be sent to. Same as OPPOSITE_FEED_ROLE plus
// Brands: Creators/Freelancers reach a Brand only by tapping "Collab" on one of
// its requirement posts (enforced in collaboration.service.js). Kept separate
// from OPPOSITE_FEED_ROLE so brand posts don't leak into the regular Home feed.
const COLLAB_TARGET_ROLES = Object.freeze({
  [ROLES.CREATOR]: [ROLES.FREELANCER, ROLES.BRAND],
  [ROLES.FREELANCER]: [ROLES.CREATOR, ROLES.BRAND],
  [ROLES.BRAND]: [ROLES.CREATOR, ROLES.FREELANCER],
  [ROLES.AGENCY]: [ROLES.CREATOR, ROLES.FREELANCER],
});

module.exports = { ROLES, ROLE_VALUES, PUBLIC_SIGNUP_ROLES, OPPOSITE_FEED_ROLE, COLLAB_TARGET_ROLES };
