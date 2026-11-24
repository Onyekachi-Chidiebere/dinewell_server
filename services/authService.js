const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const RefreshToken = require('../models/refreshToken');
const User = require('../models/user');
const { sequelize } = require('../utils/db-connection');

const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 30);

function secret(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function payloadFor(user) {
  return {
    sub: String(user.id),
    userId: user.id,
    role: user.type,
    type: user.type,
  };
}

function signAccessToken(user) {
  return jwt.sign(payloadFor(user), secret('JSON_WEB_SECRET'), {
    expiresIn: ACCESS_TTL,
    issuer: 'dinewell',
    audience: 'dinewell-api',
  });
}

async function issueTokenPair(user, options = {}) {
  const id = uuidv4();
  const familyId = options.familyId || uuidv4();
  const refreshToken = jwt.sign(
    { ...payloadFor(user), jti: id, familyId, tokenType: 'refresh' },
    secret('JSON_WEB_REFRESH_SECRET'),
    {
      expiresIn: `${REFRESH_DAYS}d`,
      issuer: 'dinewell',
      audience: 'dinewell-refresh',
    }
  );
  await RefreshToken.create({
    id,
    user_id: user.id,
    family_id: familyId,
    token_hash: hash(refreshToken),
    expires_at: new Date(Date.now() + REFRESH_DAYS * 86400000),
  }, options.transaction ? { transaction: options.transaction } : undefined);
  return { accessToken: signAccessToken(user), refreshToken };
}

async function rotateRefreshToken(token) {
  let decoded;
  try {
    decoded = jwt.verify(token, secret('JSON_WEB_REFRESH_SECRET'), {
      issuer: 'dinewell',
      audience: 'dinewell-refresh',
    });
  } catch (_) {
    const error = new Error('Invalid or expired refresh token');
    error.status = 401;
    throw error;
  }

  return sequelize.transaction(async (transaction) => {
    const record = await RefreshToken.findOne({
      where: { id: decoded.jti },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!record || record.token_hash !== hash(token) || record.revoked_at || record.expires_at <= new Date()) {
      if (record) {
        await RefreshToken.update(
          { revoked_at: new Date() },
          { where: { family_id: record.family_id }, transaction }
        );
      }
      const error = new Error('Refresh token has been revoked');
      error.status = 401;
      throw error;
    }
    const user = await User.findByPk(record.user_id, { transaction });
    if (!user || user.approval_status === -1) {
      throw Object.assign(new Error('Account is unavailable'), { status: 401 });
    }
    if (String(user.type).toLowerCase() === 'admin' && user.approval_status !== 1) {
      throw Object.assign(new Error('Admin account is not approved'), { status: 401 });
    }
    const pair = await issueTokenPair(user, { familyId: record.family_id, transaction });
    const replacement = jwt.decode(pair.refreshToken);
    await record.update({ revoked_at: new Date(), replaced_by: replacement.jti }, { transaction });
    return pair;
  });
}

async function revokeRefreshToken(token) {
  if (!token) return;
  let decoded;
  try {
    decoded = jwt.verify(token, secret('JSON_WEB_REFRESH_SECRET'), {
      issuer: 'dinewell',
      audience: 'dinewell-refresh',
    });
  } catch (_) {
    return;
  }
  const record = await RefreshToken.findByPk(decoded.jti);
  if (record && record.token_hash === hash(token) && !record.revoked_at) {
    await record.update({ revoked_at: new Date() });
  }
}

async function revokeAllForUser(userId, transaction) {
  await RefreshToken.update(
    { revoked_at: new Date() },
    { where: { user_id: userId, revoked_at: null }, transaction }
  );
}

module.exports = {
  hash,
  issueTokenPair,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
  signAccessToken,
};
