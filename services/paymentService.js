const Payment = require('../models/payments');
const Points = require('../models/points');
const User = require('../models/user');
const cardService = require('./cardService');
const { Op, fn, col } = require('sequelize');

/**
 * Calculate and charge restaurants for unpaid points issued
 * This should run daily to process payments
 */
async function processDailyPayments() {
    try {
        console.log('Starting daily payment processing...');

        // Get all approved merchants
        const merchants = await User.findAll({
            where: {
                type: 'Merchant',
                approval_status: 1 // Approved
            },
            attributes: ['id', 'restaurant_name', 'default_payment_card_id', 'payment_cards'],
            raw: true
        });

        const results = {
            processed: 0,
            successful: 0,
            failed: 0,
            errors: []
        };

        for (const merchant of merchants) {
            try {
                // Skip if no default payment card
                if (!merchant.default_payment_card_id) {
                    console.log(`Skipping merchant ${merchant.id}: No default payment card`);
                    continue;
                }

                // Get unpaid points for this restaurant (only 'issue' type, completed, not paid)
                const unpaidPoints = await Points.findAll({
                    where: {
                        restaurant_id: merchant.id,
                        type: 'issue',
                        status: 'completed',
                        paid: false
                    },
                    attributes: ['id', 'total_points', 'total_price', 'date_used'],
                    raw: true
                });

                if (unpaidPoints.length === 0) {
                    continue; // No unpaid points
                }

                // Calculate total points and amount
                // Charge rate: 10 points per $1 (so 1 point = $0.10)
                // This means if a restaurant issues 1000 points, they pay $100
                const POINTS_RATE = {
                    issue: 10 // 10 points per dollar
                };
                
                const totalPoints = unpaidPoints.reduce((sum, p) => sum + (p.total_points || 0), 0);
                // Calculate charge: total points / points per dollar
                const totalAmount = totalPoints / POINTS_RATE.issue;

                if (totalAmount <= 0 || totalPoints === 0) {
                    continue; // No amount to charge
                }

                // Get card info for display
                const cards = Array.isArray(merchant.payment_cards) ? merchant.payment_cards : [];
                const defaultCard = cards.find(c => c.id === merchant.default_payment_card_id);
                const cardLast4 = defaultCard?.last4 || '****';
                const cardBrand = defaultCard?.brand || 'card';

                // Charge the card
                let paymentIntent;
                let paymentStatus = 'pending';
                let stripePaymentIntentId = null;

                try {
                    paymentIntent = await cardService.charge({
                        userId: merchant.id,
                        amount: totalAmount,
                        currency: 'usd',
                        paymentMethodId: merchant.default_payment_card_id
                    });

                    paymentStatus = 'completed';
                    stripePaymentIntentId = paymentIntent.id;
                } catch (chargeError) {
                    console.error(`Failed to charge merchant ${merchant.id}:`, chargeError.message);
                    paymentStatus = 'failed';
                    results.failed++;
                    results.errors.push({
                        merchantId: merchant.id,
                        merchantName: merchant.restaurant_name,
                        error: chargeError.message
                    });
                    continue;
                }

                // Create payment record
                const payment = await Payment.create({
                    restaurant_id: merchant.id,
                    restaurant_name: merchant.restaurant_name,
                    amount: totalAmount,
                    points_issued: totalPoints,
                    payment_status: paymentStatus,
                    payment_date: new Date(),
                    stripe_payment_intent_id: stripePaymentIntentId,
                    points_ids: unpaidPoints.map(p => p.id),
                    type: 'debit',
                    description: `Daily payment for ${totalPoints} points issued`,
                    card_last4: cardLast4,
                    card_brand: cardBrand
                });

                // Mark points as paid
                if (paymentStatus === 'completed') {
                    await Points.update(
                        { paid: true, payment_id: payment.id },
                        {
                            where: {
                                id: { [Op.in]: unpaidPoints.map(p => p.id) }
                            }
                        }
                    );

                    results.successful++;
                    console.log(`Successfully processed payment for merchant ${merchant.id}: $${totalAmount} for ${totalPoints} points`);
                }

                results.processed++;
            } catch (error) {
                console.error(`Error processing payment for merchant ${merchant.id}:`, error);
                results.errors.push({
                    merchantId: merchant.id,
                    merchantName: merchant.restaurant_name,
                    error: error.message
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
 * Get payment history for a merchant
 */
async function getPaymentHistory(restaurantId, searchQuery = '') {
    try {
        const whereClause = { restaurant_id: restaurantId };

        // Get all payments
        const payments = await Payment.findAll({
            where: whereClause,
            order: [['payment_date', 'DESC']],
            raw: true
        });

        // Filter by search query if provided
        let filteredPayments = payments;
        if (searchQuery) {
            const searchLower = searchQuery.toLowerCase();
            filteredPayments = payments.filter(p => {
                const matchesDescription = p.description?.toLowerCase().includes(searchLower);
                const matchesType = p.type?.toLowerCase().includes(searchLower);
                const matchesStatus = p.payment_status?.toLowerCase().includes(searchLower);
                return matchesDescription || matchesType || matchesStatus;
            });
        }

        // Group by date
        const dateMap = new Map();

        filteredPayments.forEach(payment => {
            const paymentDate = payment.payment_date;
            const dateKey = new Date(paymentDate).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });

            // Format transaction
            const transaction = {
                id: payment.id.toString(),
                type: payment.type === 'debit' ? 'debit' : 'reversal',
                description: payment.description || (payment.type === 'debit' ? 'Debit' : 'Reversal'),
                cardNumber: payment.card_last4 ? `****${payment.card_last4}` : 'N/A',
                points: payment.points_issued || 0,
                amount: parseFloat(payment.amount) || 0,
                customer: payment.restaurant_name || 'Restaurant'
            };

            // Group by date
            if (!dateMap.has(dateKey)) {
                dateMap.set(dateKey, []);
            }
            dateMap.get(dateKey).push(transaction);
        });

        // Convert map to array format
        const groupedTransactions = Array.from(dateMap.entries()).map(([date, transactions]) => ({
            id: date,
            date,
            transactions
        }));

        // Sort by date descending (most recent first)
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

module.exports = {
    processDailyPayments,
    getPaymentHistory
};

