const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const User = require('../models/user');

async function ensureCustomer(user) {
  if (user.stripe_id) return user.stripe_id;
  const customer = await stripe.customers.create({
    name: user.restaurant_name || `${user.firstname || ''} ${user.lastname || ''}`.trim(),
    email: user.email,
    metadata: { user_id: String(user.id) },
  });
  await user.update({ stripe_id: customer.id });
  return customer.id;
}

async function addCard({ userId, paymentMethodId }) {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');
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
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');
  const customerId = await ensureCustomer(user);

  await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } });

  await user.update({ default_payment_card_id: paymentMethodId });
  return { success: true };
}

async function charge({ userId, amount, currency = 'usd', paymentMethodId }) {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');
  const customerId = await ensureCustomer(user);

  // If no payment method provided, use default
  const pm = paymentMethodId || user.default_payment_card_id;
  if (!pm) throw new Error('No payment method specified');

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(Number(amount) * 100),
    currency,
    customer: customerId,
    payment_method: pm,
    confirm: true,
    off_session: true,
  });

  return paymentIntent;
}

async function listCards({ userId }) {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');
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
