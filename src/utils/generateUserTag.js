const { prisma } = require('../config/db');

/**
 * Generates the internal "DigiTag" for a user: LOC-LANG-R-NNNNN
 *   LOC   = first 3 letters of their location  (UNK when not provided)
 *   LANG  = first 3 letters of their primary language (UNK when not provided)
 *   R     = role character: C = CREATOR, F = FREELANCER
 *   NNNNN = 5 random digits
 *
 * Example: HYD-TEL-C-48291 (Hyderabad, Telugu, Creator)
 *
 * Admin/staff-only — stored in the UserTag table, never on the profile row,
 * so no user-facing endpoint can ever return it. Linked to the public tagId
 * (245C457-style) through userId.
 */

const ROLE_CHAR = { CREATOR: 'C', FREELANCER: 'F', BRAND: 'B', AGENCY: 'A' };

function letters3(value, fallback) {
  const s = String(value || '').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
  return s.length === 3 ? s : (s ? s.padEnd(3, 'X') : fallback);
}

function randomFiveDigits() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

/** Creates (or returns the existing) tag for a user+role. Never throws for
 *  duplicate-friendly cases — profile creation must not fail over a tag. */
async function ensureUserTag({ userId, role, location, language }) {
  const existing = await prisma.userTag.findUnique({
    where: { userId_role: { userId, role } },
  });
  if (existing) return existing.tag;

  const prefix = `${letters3(location, 'UNK')}-${letters3(language, 'UNK')}-${ROLE_CHAR[role] || 'U'}-`;

  let tag;
  let attempts = 0;
  do {
    tag = `${prefix}${randomFiveDigits()}`;
    attempts++;
    if (attempts > 20) {
      tag = `${prefix}${String(Date.now()).slice(-5)}`;
      break;
    }
  } while (await prisma.userTag.findUnique({ where: { tag } }));

  await prisma.userTag.create({ data: { userId, role, tag } });
  return tag;
}

module.exports = { ensureUserTag };
