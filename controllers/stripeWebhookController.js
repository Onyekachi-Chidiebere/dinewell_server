const Stripe = require('stripe');
const { Op } = require('sequelize');
const Payment = require('../models/payments');
const Points = require('../models/points');
const User = require('../models/user');
const { sequelize } = require('../utils/db-connection');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

exports.handle = async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (_) {
    return res.status(400).json({ error: 'Invalid Stripe webhook signature' });
  }

  const intent = event.data.object;
  const status = event.type === 'payment_intent.succeeded'
    ? 'completed'
    : event.type === 'payment_intent.payment_failed'
      ? 'failed'
      : null;
  if (status) {
    await sequelize.transaction(async (transaction) => {
      const payment = await Payment.findOne({
        where: { stripe_payment_intent_id: intent.id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!payment) return;
      await payment.update({
        payment_status: status,
        error_message: status === 'failed' ? intent.last_payment_error?.message || 'Payment failed' : null,
      }, { transaction });
      if (status === 'completed') {
        await Points.update(
          { paid: true, payment_id: payment.id },
          { where: { id: { [Op.in]: payment.points_ids } }, transaction }
        );
        await User.update(
          { payment_failed: false },
          { where: { id: payment.restaurant_id }, transaction }
        );
      } else {
        await User.update(
          { payment_failed: true },
          { where: { id: payment.restaurant_id }, transaction }
        );
      }
    });
  }
  return res.json({ received: true });
};
