const { prisma } = require('../config/db');

/**
 * Generates a unique Tag ID: CITY(3) + LANG(3) + ROLE(1) + RANDOM(5)
 * Example: HYDHIMC98765
 *
 *   [0-2]  3 uppercase letters from city/location   (e.g. HYD)
 *   [3-5]  3 uppercase letters from primary language (e.g. HIN)
 *   [6]    role character: C = CREATOR, F = FREELANCER
 *   [7-11] 5 random digits                           (e.g. 98765)
 */

const ROLE_CHAR = {
  CREATOR: 'C',
  FREELANCER: 'F',
};

function segment(str, len) {
  const letters = (str || '').replace(/[^a-zA-Z]/g, '').toUpperCase();
  return letters.slice(0, len).padEnd(len, 'X');
}

function randomFiveDigits() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

async function isTagIdTaken(tagId, model) {
  const record = await prisma[model].findUnique({ where: { tagId } });
  return !!record;
}

/**
 * @param {object} opts
 * @param {string} opts.location      - City / location from profile
 * @param {string} opts.language      - Primary language from profile
 * @param {string} opts.mobileNumber  - User's mobile number (kept for compat, unused in ID)
 * @param {'CREATOR'|'FREELANCER'} opts.role
 * @param {'creatorProfile'|'freelancerProfile'} opts.model
 * @returns {Promise<string>}
 */
async function generateTagId({ location, language, mobileNumber, role, model }) {
  const city = segment(location?.split(/[\s,]+/)[0], 3);
  const lang = segment(language, 3);
  const roleChar = ROLE_CHAR[role] || 'U';

  let tagId;
  let attempts = 0;

  do {
    tagId = `${city}${lang}${roleChar}${randomFiveDigits()}`;
    attempts++;
    if (attempts > 20) {
      tagId = `${city}${lang}${roleChar}${String(Date.now()).slice(-5)}`;
      break;
    }
  } while (await isTagIdTaken(tagId, model));

  return tagId;
}

module.exports = { generateTagId };
