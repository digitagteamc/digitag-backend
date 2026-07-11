/* global Buffer */
const crypto = require('crypto');
const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiResponse');
const env = require('../../config/env');

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
  return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${encodeURIComponent(env.FACEBOOK_APP_ID)}&redirect_uri=${redirect}&state=${encodeURIComponent(state)}&scope=public_profile`;
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
  if (!accessToken) throw ApiError.badRequest('Account authorization was not completed');
  if (platform === 'YOUTUBE') {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true&access_token=${encodeURIComponent(accessToken)}`);
    const data = await res.json(); const channel = data.items?.[0];
    if (!channel?.id) throw ApiError.badRequest('No YouTube channel was found for this Google account');
    return { id: channel.id, name: channel.snippet?.title || channel.id, followers: Number(channel.statistics?.subscriberCount) || null };
  }
  const res = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`);
  const data = await res.json(); if (!data.id) throw ApiError.badRequest('Facebook account could not be read');
  return { id: data.id, name: data.name || data.id, followers: null };
}
async function complete(platform, query) {
  const { id } = readState(query.state); const record = await prisma.socialVerification.findUnique({ where: { id } });
  if (!record || record.platform !== platform || record.status !== 'PENDING' || record.expiresAt < new Date() || query.error) { if (record?.status === 'PENDING') await prisma.socialVerification.update({ where: { id }, data: { status: 'FAILED' } }); return { id, status: 'FAILED' }; }
  try {
    const account = await socialAccount(platform, query.code);
    const existing = await prisma.socialVerification.findFirst({ where: { platform, socialAccountId: account.id, status: 'VERIFIED', NOT: { userId: record.userId } } });
    if (existing) throw ApiError.conflict('This social account is already verified by another DigiTag user');
    await prisma.socialVerification.update({ where: { id }, data: { status: 'VERIFIED', socialAccountId: account.id, accountName: account.name, verifiedAt: new Date() } });
    const data = platform === 'YOUTUBE' ? { youtubeHandle: account.id, ...(account.followers !== null ? { youtubeFollowers: account.followers } : {}) } : { facebookHandle: account.id };
    await prisma.user.findUnique({ where: { id: record.userId }, select: { role: true } }).then((user) => user?.role === 'CREATOR' ? prisma.creatorProfile.updateMany({ where: { userId: record.userId }, data }) : prisma.freelancerProfile.updateMany({ where: { userId: record.userId }, data }));
    return { id, status: 'VERIFIED' };
  } catch (_error) { await prisma.socialVerification.update({ where: { id }, data: { status: 'FAILED' } }); return { id, status: 'FAILED' }; }
}
async function status(userId, id) { const record = await prisma.socialVerification.findFirst({ where: { id, userId } }); if (!record) throw ApiError.notFound('Verification record not found'); if (record.status === 'PENDING' && record.expiresAt < new Date()) return prisma.socialVerification.update({ where: { id }, data: { status: 'EXPIRED' } }); return record; }
const appRedirect = (id, status) => `${env.APP_DEEP_LINK_URL}?id=${encodeURIComponent(id)}&status=${encodeURIComponent(status)}`;
module.exports = { start, status, complete, appRedirect };
