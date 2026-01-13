const paymentService = require('../services/paymentService');

/**
 * Get payment history for a merchant
 */
exports.getPaymentHistory = async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { searchQuery = '' } = req.query;

        if (!restaurantId) {
            return res.status(400).json({ 
                error: 'Restaurant ID is required' 
            });
        }

        const result = await paymentService.getPaymentHistory(restaurantId, searchQuery);
        res.json(result);
    } catch (err) {
        console.error('Get payment history error:', err);
        res.status(400).json({ 
            error: err.message || 'Failed to get payment history' 
        });
    }
};

/**
 * Manually trigger daily payment processing (for testing/admin)
 */
exports.processDailyPayments = async (req, res) => {
    try {
        const result = await paymentService.processDailyPayments();
        res.json({
            success: true,
            ...result
        });
    } catch (err) {
        console.error('Process daily payments error:', err);
        res.status(400).json({ 
            error: err.message || 'Failed to process daily payments' 
        });
    }
};

