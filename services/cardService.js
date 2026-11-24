const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const User = require('../models/user');

function getCustomerDetails(user) {
  return {
    name: user.restaurant_name || `${user.firstname || ''} ${user.lastname || ''}`.trim() || undefined,
    email: user.email || undefined,
    metadata: { user_id: String(user.id) },
  };
}

async function createStripeCustomer(user) {
  const customer = await stripe.customers.create(getCustomerDetails(user));
  await user.update({ stripe_id: customer.id });
  return customer.id;
}

async function ensureCustomer(user) {
  if (user.stripe_id) {
    try {
      const customer = await stripe.customers.retrieve(user.stripe_id);

      if (customer.deleted) {
        return createStripeCustomer(user);
      }

      return user.stripe_id;
    } catch (err) {
      // Stale ID (wrong Stripe mode/account, deleted in dashboard, etc.)
      if (err.code === 'resource_missing' || err.statusCode === 404) {
        return createStripeCustomer(user);
      }
      throw err;
    }
  }

  return createStripeCustomer(user);
}

async function addCard({ userId, paymentMethodId }) {
  if (!paymentMethodId || !String(paymentMethodId).startsWith('pm_')) throw new Error('Valid Stripe PaymentMethod ID required');
  const user = await User.findOne({ where: { id: userId, type: 'Merchant' } });
  if (!user) throw new Error('Merchant not found');
  const customerId = await ensureCustomer(user);

  // Attach payment method
  await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });

  // Retrieve PM to store useful metadata
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

  const payment_cards = Array.isArray(user.payment_cards) ? [...user.payment_cards] : [];
  const cardData = {
    id: pm.id,
    brand: pm.card?.brand,
    last4: pm.card?.last4,
    exp_month: pm.card?.exp_month,
    exp_year: pm.card?.exp_year,
  };
  payment_cards.push(cardData);

  // If no default card yet, set this as default
  const updates = { payment_cards };
  if (!user.default_payment_card_id) {
    await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pm.id } });
    updates.default_payment_card_id = pm.id;
  }
  await user.update(updates);

  return cardData;
}

async function setDefaultCard({ userId, paymentMethodId }) {
  const user = await User.findOne({ where: { id: userId, type: 'Merchant' } });
  if (!user) throw new Error('Merchant not found');
  const customerId = await ensureCustomer(user);
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (pm.customer !== customerId) throw new Error('PaymentMethod does not belong to this merchant');

  await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } });

  await user.update({ default_payment_card_id: paymentMethodId });
  return { success: true };
}

async function charge({ userId, amount, currency = 'usd', paymentMethodId, idempotencyKey }) {
  const user = await User.findOne({ where: { id: userId, type: 'Merchant' } });
  if (!user) throw new Error('Merchant not found');
  const customerId = await ensureCustomer(user);

  // If no payment method provided, use default
  const pm = paymentMethodId || user.default_payment_card_id;
  if (!pm) throw new Error('No payment method specified');

  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) throw new Error('Invalid server-calculated charge amount');
  if (!idempotencyKey) throw new Error('Idempotency key required');
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(Number(amount) * 100),
    currency,
    customer: customerId,
    payment_method: pm,
    confirm: true,
    off_session: true,
  }, { idempotencyKey });

  return paymentIntent;
}

async function listCards({ userId }) {
  const user = await User.findOne({ where: { id: userId, type: 'Merchant' } });
  if (!user) throw new Error('Merchant not found');
  const customerId = await ensureCustomer(user);
  const customer = await stripe.customers.retrieve(customerId);

  const pms = await stripe.paymentMethods.list({ customer: customerId, type: 'card' });
  return {
    default_payment_card_id: customer.invoice_settings.default_payment_method,
    cards: pms.data.map(pm => ({
      id: pm.id,
      brand: pm.card?.brand,
      last4: pm.card?.last4,
      exp_month: pm.card?.exp_month,
      exp_year: pm.card?.exp_year,
    })),
  };
}

module.exports = { addCard, setDefaultCard, charge, listCards };
