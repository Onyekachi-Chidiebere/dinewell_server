const PlatformSettings = require('../models/platformSettings');
const Points = require('../models/points');
const User = require('../models/user');
const { fn, col } = require('sequelize');

const DEFAULTS = {
  customer_earn_rate: 10,
  customer_redeem_rate: 500,
  merchant_billing_rate: 0.1,
  debt_limit_usd: 100,
};

function normalizeSettings(row) {
  return {
    customerEarnRate: Number(row.customer_earn_rate),
    customerRedeemRate: Number(row.customer_redeem_rate),
    merchantBillingRate: Number(row.merchant_billing_rate),
    debtLimitUsd: Number(row.debt_limit_usd),
    updatedAt: row.updated_at,
  };
}

async function ensureSettings() {
  let row = await PlatformSettings.findByPk(1);
  if (!row) {
    row = await PlatformSettings.create({ id: 1, ...DEFAULTS, updated_at: new Date() });
  }
  return row;
}

async function getSettings() {
  const row = await ensureSettings();
  return normalizeSettings(row);
}

/**
 * Rates used by merchant/client apps for earn/redeem math.
 */
async function getPointsRate() {
  const settings = await getSettings();
  return {
    issue: settings.customerEarnRate,
    redeem: settings.customerRedeemRate,
  };
}

async function updateSettings(updates = {}) {
  const row = await ensureSettings();

  const next = {
    customer_earn_rate:
      updates.customerEarnRate !== undefined
        ? Number(updates.customerEarnRate)
        : Number(row.customer_earn_rate),
    customer_redeem_rate:
      updates.customerRedeemRate !== undefined
        ? Number(updates.customerRedeemRate)
        : Number(row.customer_redeem_rate),
    merchant_billing_rate:
      updates.merchantBillingRate !== undefined
        ? Number(updates.merchantBillingRate)
        : Number(row.merchant_billing_rate),
    debt_limit_usd:
      updates.debtLimitUsd !== undefined
        ? Number(updates.debtLimitUsd)
        : Number(row.debt_limit_usd),
    updated_at: new Date(),
  };

  if (next.customer_earn_rate <= 0) throw new Error('Customer earn rate must be greater than 0');
  if (next.customer_redeem_rate <= 0) throw new Error('Customer redeem rate must be greater than 0');
  if (next.merchant_billing_rate < 0) throw new Error('Merchant billing rate cannot be negative');
  if (next.debt_limit_usd < 0) throw new Error('Debt limit cannot be negative');

  await row.update(next);

  // Re-evaluate all merchants against the new debt limit
  const merchants = await User.findAll({
    where: { type: 'Merchant' },
    attributes: ['id'],
  });
  await Promise.all(
    merchants.map((m) =>
      refreshRestaurantBillingStatus(m.id).catch((err) =>
        console.error(`Failed to refresh billing for merchant ${m.id}:`, err.message)
      )
    )
  );

  return normalizeSettings(row);
}

async function getUnpaidIssuedPoints(restaurantId) {
  const [row] = await Points.findAll({
    attributes: [[fn('COALESCE', fn('SUM', col('total_points')), 0), 'sum']],
    where: {
      restaurant_id: restaurantId,
      type: 'issue',
      status: 'completed',
      paid: false,
    },
    raw: true,
  });
  return Number(row?.sum || 0);
}

async function getRestaurantDebt(restaurantId) {
  const settings = await getSettings();
  const unpaidPoints = await getUnpaidIssuedPoints(restaurantId);
  const owedUsd = unpaidPoints * settings.merchantBillingRate;

  return {
    unpaidPoints,
    owedUsd: Number(owedUsd.toFixed(2)),
    debtLimitUsd: settings.debtLimitUsd,
    merchantBillingRate: settings.merchantBillingRate,
    overLimit: owedUsd >= settings.debtLimitUsd,
  };
}

/**
 * Sync points_blocked from current unpaid debt vs global limit.
 * Clears payment_failed only when explicitly requested (after successful charge).
 */
async function refreshRestaurantBillingStatus(restaurantId, { clearPaymentFailed = false } = {}) {
  const merchant = await User.findByPk(restaurantId);
  if (!merchant || merchant.type !== 'Merchant') {
    throw new Error('Restaurant not found');
  }

  const debt = await getRestaurantDebt(restaurantId);
  const updates = {
    points_blocked: debt.overLimit,
  };

  if (clearPaymentFailed) {
    updates.payment_failed = false;
  }

  await merchant.update(updates);

  return {
    ...debt,
    pointsBlocked: debt.overLimit,
    paymentFailed: clearPaymentFailed ? false : !!merchant.payment_failed,
    hasCard: !!merchant.default_payment_card_id,
  };
}

async function assertCanGeneratePoints(restaurantId) {
  const status = await refreshRestaurantBillingStatus(restaurantId);
  if (status.pointsBlocked) {
    const error = new Error(
      `Point generation is blocked. Unpaid balance ($${status.owedUsd.toFixed(2)}) has reached the limit of $${status.debtLimitUsd.toFixed(2)}. Add or update a payment method so outstanding points can be charged.`
    );
    error.code = 'POINTS_BLOCKED';
    error.billing = status;
    throw error;
  }
  return status;
}

module.exports = {
  DEFAULTS,
  getSettings,
  updateSettings,
  getPointsRate,
  getUnpaidIssuedPoints,
  getRestaurantDebt,
  refreshRestaurantBillingStatus,
  assertCanGeneratePoints,
  ensureSettings,
};
