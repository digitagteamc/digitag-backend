/* global Buffer */
const crypto = require('crypto');
const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const env = require('../../config/env');
const logger = require('../../utils/logger');

const EXPIRY_MS = 10 * 60 * 1000;
const stateSecret = () => env.JWT_ACCESS_SECRET;
const b64 = (value) => Buffer.from(value).toString('base64url');
const unb64 = (value) => Buffer.from(value, 'base64url').toString();
const sign = (value) => crypto.createHmac('sha256', stateSecret()).update(value).digest('base64url');
const stateFor = (id) => { const value = b64(JSON.stringify({ id, exp: Date.now() + EXPIRY_MS })); return `${value}.${sign(value)}`; };
function readState(state) {
  const [value, signature] = String(state || '').split('.');
  const expected = value ? sign(value) : '';
  if (!value || !signature || expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) throw ApiError.badRequest('Invalid verification state');
  const parsed = JSON.parse(unb64(value));
  if (!parsed.id || parsed.exp < Date.now()) throw ApiError.badRequest('Verification session expired');
  return parsed;
}
function configured(platform) {
  if (!env.SOCIAL_OAUTH_REDIRECT_URI) return false;
  return platform === 'YOUTUBE' ? Boolean(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET) : Boolean(env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET);
}
function authUrl(platform, state) {
  const redirect = encodeURIComponent(`${env.SOCIAL_OAUTH_REDIRECT_URI.replace(/\/$/, '')}/${platform.toLowerCase()}`);
  if (platform === 'YOUTUBE') return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(env.GOOGLE_OAUTH_CLIENT_ID)}&redirect_uri=${redirect}&response_type=code&scope=${encodeURIComponent('https://www.googleapis.com/auth/youtube.readonly')}&access_type=online&state=${encodeURIComponent(state)}`;
  // "Facebook Login for Business" apps reject plain scopes — they require a
  // dashboard-created Configuration passed as config_id, which defines the
  // permissions itself. Classic Facebook Login apps use scope as usual.
  // pages_show_list needs its own Meta App Review (Advanced Access) — only
  // request it once that's approved, or every login gets stuck for non-admins
  // the same way public_profile did before business verification.
  const fbScopes = env.FACEBOOK_PAGES_ENABLED ? 'public_profile,pages_show_list' : 'public_profile';
  const fbAuth = platform === 'FACEBOOK' && env.FACEBOOK_LOGIN_CONFIG_ID
    ? `config_id=${encodeURIComponent(env.FACEBOOK_LOGIN_CONFIG_ID)}`
    : `scope=${fbScopes}`;
  return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${encodeURIComponent(env.FACEBOOK_APP_ID)}&redirect_uri=${redirect}&state=${encodeURIComponent(state)}&response_type=code&${fbAuth}`;
}
async function start(userId, platform) {
  if (!configured(platform)) throw ApiError.internal(`${platform === 'YOUTUBE' ? 'YouTube' : 'Facebook'} verification is not configured yet`);
  await prisma.socialVerification.updateMany({ where: { userId, platform, status: 'PENDING' }, data: { status: 'EXPIRED' } });
  const record = await prisma.socialVerification.create({ data: { userId, platform, expiresAt: new Date(Date.now() + EXPIRY_MS) } });
  return { id: record.id, platform, authorizationUrl: authUrl(platform, stateFor(record.id)), expiresAt: record.expiresAt };
}
async function socialAccount(platform, code) {
  const redirect_uri = `${env.SOCIAL_OAUTH_REDIRECT_URI.replace(/\/$/, '')}/${platform.toLowerCase()}`;
  const tokenEndpoint = platform === 'YOUTUBE' ? 'https://oauth2.googleapis.com/token' : 'https://graph.facebook.com/v21.0/oauth/access_token';
  const params = platform === 'YOUTUBE'
    ? { code, client_id: env.GOOGLE_OAUTH_CLIENT_ID, client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET, redirect_uri, grant_type: 'authorization_code' }
    : { code, client_id: env.FACEBOOK_APP_ID, client_secret: env.FACEBOOK_APP_SECRET, redirect_uri };
  const facebookTokenUrl = `${tokenEndpoint}?${new URLSearchParams(params).toString()}`;
  const tokenRes = await fetch(platform === 'YOUTUBE' ? tokenEndpoint : facebookTokenUrl, { method: platform === 'YOUTUBE' ? 'POST' : 'GET', headers: platform === 'YOUTUBE' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined, body: platform === 'YOUTUBE' ? new URLSearchParams(params) : undefined });
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    logger.error('[social verification] token exchange failed', { platform, response: tokenData });
    throw ApiError.badRequest('Account authorization was not completed');
  }
  if (platform === 'YOUTUBE') {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true&access_token=${encodeURIComponent(accessToken)}`);
    const data = await res.json();
    if (data.error) {
      // e.g. the YouTube Data API not being enabled in the Cloud project looks
      // identical to "no channel" unless we surface the API's own error.
      logger.error('[social verification] YouTube API error', { code: data.error.code, message: data.error.message });
      throw ApiError.badRequest('Could not read the YouTube channel for this account');
    }
    const channel = data.items?.[0];
    if (!channel?.id) throw ApiError.badRequest('No YouTube channel was found for this Google account');
    // Prefer the human @handle for the stored profile field — raw UC… channel IDs
    // don't resolve under youtube.com/@…. Dedupe still keys on the immutable id.
    const handle = (channel.snippet?.customUrl || '').replace(/^@/, '') || channel.id;
    return { id: channel.id, handle, name: channel.snippet?.title || channel.id, followers: Number(channel.statistics?.subscriberCount) || null };
  }
  // Prefer a Page the user manages (a real public presence) over their personal
  // profile, when pages_show_list is enabled and approved. Falls through to the
  // personal profile below if they have none, or the permission isn't granted
  // yet (pre-approval logins, or the user simply denied that specific scope).
  if (env.FACEBOOK_PAGES_ENABLED) {
    const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name&access_token=${encodeURIComponent(accessToken)}`);
    const pagesData = await pagesRes.json();
    const page = pagesData.data?.[0];
    if (page?.id) return { id: page.id, name: page.name || page.id, followers: null };
    if (pagesData.error) logger.warn('[social verification] pages_show_list unavailable, falling back to profile', { message: pagesData.error.message });
  }
  const res = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`);
  const data = await res.json(); if (!data.id) throw ApiError.badRequest('Facebook account could not be read');
  return { id: data.id, name: data.name || data.id, followers: null };
}
async function complete(platform, query) {
  // A bad/expired/tampered state must still send the browser back into the app
  // (as FAILED) rather than dead-ending on raw JSON — the mobile side only
  // needs the redirect to fire to close its in-app browser session; it looks
  // up the real status separately using the id it already holds.
  let id;
  try {
    ({ id } = readState(query.state));
  } catch {
    return { id: null, status: 'FAILED' };
  }
  const record = await prisma.socialVerification.findUnique({ where: { id } });
  if (!record || record.platform !== platform || record.status !== 'PENDING' || record.expiresAt < new Date() || query.error) { if (record?.status === 'PENDING') await prisma.socialVerification.update({ where: { id }, data: { status: 'FAILED' } }); return { id, status: 'FAILED' }; }
  try {
    const account = await socialAccount(platform, query.code);
    // Block only if a genuinely different account (different phone number)
    // already verified this — a sibling role-profile of the SAME account
    // (same person, switched roles) isn't "another" user. Same pattern as
    // Instagram verification.
    const currentUser = await prisma.user.findUnique({ where: { id: record.userId }, select: { accountId: true } });
    const existing = await prisma.socialVerification.findFirst({
      where: {
        platform,
        socialAccountId: account.id,
        status: 'VERIFIED',
        NOT: currentUser?.accountId ? { user: { accountId: currentUser.accountId } } : { userId: record.userId },
      },
    });
    if (existing) throw ApiError.conflict('This social account is already verified by another DigiTag user');
    // Drop any previous VERIFIED row for this exact (platform, socialAccountId)
    // — the global unique index on that pair otherwise makes re-verification
    // fail, including a sibling role of the SAME account verifying the same
    // channel/page (already ruled out as belonging to a different account above).
    await prisma.socialVerification.deleteMany({
      where: {
        platform,
        socialAccountId: account.id,
        status: 'VERIFIED',
        ...(currentUser?.accountId ? { user: { accountId: currentUser.accountId } } : { userId: record.userId }),
      },
    });
    await prisma.socialVerification.update({ where: { id }, data: { status: 'VERIFIED', socialAccountId: account.id, accountName: account.name, verifiedAt: new Date() } });
    const data = platform === 'YOUTUBE' ? { youtubeHandle: account.handle || account.id, ...(account.followers !== null ? { youtubeFollowers: account.followers } : {}) } : { facebookHandle: account.id };
    await prisma.user.findUnique({ where: { id: record.userId }, select: { role: true } }).then((user) => user?.role === 'CREATOR' ? prisma.creatorProfile.updateMany({ where: { userId: record.userId }, data }) : prisma.freelancerProfile.updateMany({ where: { userId: record.userId }, data }));
    return { id, status: 'VERIFIED' };
  } catch (error) {
    logger.error('[social verification] completion failed', { id, platform, err: error.message });
    // ApiError messages here are already written to be shown to the user (e.g.
    // "No YouTube channel was found…"); anything else is an unexpected/internal
    // failure, so fall back to a generic reason rather than leaking it raw.
    const failureReason = error instanceof ApiError ? error.message : 'Verification could not be completed';
    await prisma.socialVerification.update({ where: { id }, data: { status: 'FAILED', failureReason } });
    return { id, status: 'FAILED', failureReason };
  }
}
async function status(userId, id) { const record = await prisma.socialVerification.findFirst({ where: { id, userId } }); if (!record) throw ApiError.notFound('Verification record not found'); if (record.status === 'PENDING' && record.expiresAt < new Date()) return prisma.socialVerification.update({ where: { id }, data: { status: 'EXPIRED' } }); return record; }
const appRedirect = (id, status) => `${env.APP_DEEP_LINK_URL}?id=${encodeURIComponent(id)}&status=${encodeURIComponent(status)}`;
module.exports = { start, status, complete, appRedirect };
