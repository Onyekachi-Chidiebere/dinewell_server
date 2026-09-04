const Payment = require('../models/payments');
const Points = require('../models/points');
const User = require('../models/user');
const cardService = require('./cardService');
const platformSettingsService = require('./platformSettingsService');
const { Op, fn, col } = require('sequelize');

/**
 * Calculate and charge restaurants for unpaid points issued.
 * Runs daily; also callable manually by admin.
 */
async function processDailyPayments() {
    try {
        console.log('Starting daily payment processing...');

        const settings = await platformSettingsService.getSettings();
        const billingRate = settings.merchantBillingRate;

        const merchants = await User.findAll({
            where: {
                type: 'Merchant',
                approval_status: 1,
            },
            attributes: [
                'id',
                'restaurant_name',
                'default_payment_card_id',
                'payment_cards',
            ],
            raw: true,
        });

        const results = {
            processed: 0,
            successful: 0,
            failed: 0,
            skippedNoCard: 0,
            errors: [],
        };

        for (const merchant of merchants) {
            try {
                const unpaidPoints = await Points.findAll({
                    where: {
                        restaurant_id: merchant.id,
                        type: 'issue',
                        status: 'completed',
                        paid: false,
                    },
                    attributes: ['id', 'total_points', 'total_price', 'date_used'],
                    raw: true,
                });

                if (unpaidPoints.length === 0) {
                    await platformSettingsService.refreshRestaurantBillingStatus(merchant.id);
                    continue;
                }

                const totalPoints = unpaidPoints.reduce(
                    (sum, p) => sum + (Number(p.total_points) || 0),
                    0
                );
                const totalAmount = Number((totalPoints * billingRate).toFixed(2));

                if (totalAmount <= 0 || totalPoints === 0) {
                    continue;
                }

                const cards = Array.isArray(merchant.payment_cards)
                    ? merchant.payment_cards
                    : [];
                const defaultCard = cards.find(
                    (c) => c.id === merchant.default_payment_card_id
                );
                const cardLast4 = defaultCard?.last4 || null;
                const cardBrand = defaultCard?.brand || null;

                if (!merchant.default_payment_card_id) {
                    console.log(`Skipping merchant ${merchant.id}: No default payment card`);
                    results.skippedNoCard++;
                    await platformSettingsService.refreshRestaurantBillingStatus(merchant.id);
                    continue;
                }

                let paymentStatus = 'pending';
                let stripePaymentIntentId = null;
                let errorMessage = null;

                try {
                    const paymentIntent = await cardService.charge({
                        userId: merchant.id,
                        amount: totalAmount,
                        currency: 'usd',
                        paymentMethodId: merchant.default_payment_card_id,
                    });
                    paymentStatus = 'completed';
                    stripePaymentIntentId = paymentIntent.id;
                } catch (chargeError) {
                    console.error(
                        `Failed to charge merchant ${merchant.id}:`,
                        chargeError.message
                    );
                    paymentStatus = 'failed';
                    errorMessage = chargeError.message;
                }

                const payment = await Payment.create({
                    restaurant_id: merchant.id,
                    restaurant_name: merchant.restaurant_name,
                    amount: totalAmount,
                    points_issued: totalPoints,
                    payment_status: paymentStatus,
                    payment_date: new Date(),
                    stripe_payment_intent_id: stripePaymentIntentId,
                    points_ids: unpaidPoints.map((p) => p.id),
                    type: 'debit',
                    description:
                        paymentStatus === 'completed'
                            ? `Payment for ${totalPoints} points issued`
                            : `Failed charge for ${totalPoints} points issued`,
                    card_last4: cardLast4,
                    card_brand: cardBrand,
                    error_message: errorMessage,
                });

                if (paymentStatus === 'completed') {
                    await Points.update(
                        { paid: true, payment_id: payment.id },
                        {
                            where: {
                                id: { [Op.in]: unpaidPoints.map((p) => p.id) },
                            },
                        }
                    );
                    await platformSettingsService.refreshRestaurantBillingStatus(
                        merchant.id,
                        { clearPaymentFailed: true }
                    );
                    results.successful++;
                    console.log(
                        `Successfully processed payment for merchant ${merchant.id}: $${totalAmount} for ${totalPoints} points`
                    );
                } else {
                    await User.update(
                        { payment_failed: true },
                        { where: { id: merchant.id } }
                    );
                    await platformSettingsService.refreshRestaurantBillingStatus(
                        merchant.id
                    );

                    try {
                        const notificationService = require('./notificationService');
                        await notificationService.createNotification({
                            userId: merchant.id,
                            title: 'Payment failed',
                            body: `We could not charge your card for $${totalAmount.toFixed(2)} (${totalPoints} points). Update your payment method to avoid being blocked.`,
                            type: 'payment_failed',
                            data: {
                                amount: totalAmount,
                                points: totalPoints,
                                error: errorMessage,
                            },
                        });
                    } catch (notifyErr) {
                        console.error('Payment failed notification error:', notifyErr.message);
                    }

                    results.failed++;
                    results.errors.push({
                        merchantId: merchant.id,
                        merchantName: merchant.restaurant_name,
                        error: errorMessage,
                    });
                }

                results.processed++;
            } catch (error) {
                console.error(
                    `Error processing payment for merchant ${merchant.id}:`,
                    error
                );
                results.errors.push({
                    merchantId: merchant.id,
                    merchantName: merchant.restaurant_name,
                    error: error.message,
                });
                results.failed++;
            }
        }

        console.log('Daily payment processing completed:', results);
        return results;
    } catch (error) {
        console.error('Error in daily payment processing:', error);
        throw error;
    }
}

/**
 * Get payment history for a merchant (wallet UI)
 */
async function getPaymentHistory(restaurantId, searchQuery = '') {
    try {
        const whereClause = { restaurant_id: restaurantId };

        const payments = await Payment.findAll({
            where: whereClause,
            order: [['payment_date', 'DESC']],
            raw: true,
        });

        let filteredPayments = payments;
        if (searchQuery) {
            const searchLower = searchQuery.toLowerCase();
            filteredPayments = payments.filter((p) => {
                const matchesDescription = p.description
                    ?.toLowerCase()
                    .includes(searchLower);
                const matchesType = p.type?.toLowerCase().includes(searchLower);
                const matchesStatus = p.payment_status
                    ?.toLowerCase()
                    .includes(searchLower);
                return matchesDescription || matchesType || matchesStatus;
            });
        }

        const dateMap = new Map();

        filteredPayments.forEach((payment) => {
            const paymentDate = payment.payment_date;
            const dateKey = new Date(paymentDate).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            });

            const transaction = {
                id: payment.id.toString(),
                type: payment.type === 'debit' ? 'debit' : 'reversal',
                description:
                    payment.description ||
                    (payment.type === 'debit' ? 'Debit' : 'Reversal'),
                cardNumber: payment.card_last4
                    ? `****${payment.card_last4}`
                    : 'N/A',
                points: payment.points_issued || 0,
                amount: parseFloat(payment.amount) || 0,
                customer: payment.restaurant_name || 'Restaurant',
                status: payment.payment_status,
            };

            if (!dateMap.has(dateKey)) {
                dateMap.set(dateKey, []);
            }
            dateMap.get(dateKey).push(transaction);
        });

        const groupedTransactions = Array.from(dateMap.entries()).map(
            ([date, transactions]) => ({
                id: date,
                date,
                transactions,
            })
        );

        groupedTransactions.sort((a, b) => {
            const dateA = new Date(a.date.split('/').reverse().join('-'));
            const dateB = new Date(b.date.split('/').reverse().join('-'));
            return dateB - dateA;
        });

        return groupedTransactions;
    } catch (error) {
        console.error('Error getting payment history:', error);
        throw new Error(`${error.message}`);
    }
}

/**
 * Admin list of card charges (completed + failed)
 */
async function getPaymentsForAdmin(page = 1, limit = 10, statusFilter = 'all') {
    const offset = (page - 1) * limit;
    const where = {};

    if (statusFilter === 'completed' || statusFilter === 'failed') {
        where.payment_status = statusFilter;
    } else if (statusFilter === 'all') {
        where.payment_status = { [Op.in]: ['completed', 'failed'] };
    }

    const [totalCompleted, totalFailed, filteredCount] = await Promise.all([
        Payment.count({ where: { payment_status: 'completed' } }),
        Payment.count({ where: { payment_status: 'failed' } }),
        Payment.count({ where }),
    ]);

    const [completedAmountRow] = await Payment.findAll({
        attributes: [[fn('COALESCE', fn('SUM', col('amount')), 0), 'sum']],
        where: { payment_status: 'completed' },
        raw: true,
    });

    const payments = await Payment.findAll({
        where,
        order: [['payment_date', 'DESC']],
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        raw: true,
    });

    return {
        statistics: {
            all: totalCompleted + totalFailed,
            completed: totalCompleted,
            failed: totalFailed,
            totalCollected: Number(completedAmountRow?.sum || 0),
        },
        payments: payments.map((p) => ({
            id: p.id,
            restaurantId: p.restaurant_id,
            restaurantName: p.restaurant_name,
            amount: Number(p.amount),
            pointsIssued: p.points_issued,
            status: p.payment_status,
            paymentDate: p.payment_date,
            cardLast4: p.card_last4,
            cardBrand: p.card_brand,
            stripePaymentIntentId: p.stripe_payment_intent_id,
            description: p.description,
            errorMessage: p.error_message,
        })),
        pagination: {
            currentPage: parseInt(page, 10),
            totalPages: Math.ceil(filteredCount / limit) || 1,
            totalItems: filteredCount,
            itemsPerPage: parseInt(limit, 10),
        },
    };
}

module.exports = {
    processDailyPayments,
    getPaymentHistory,
    getPaymentsForAdmin,
};
