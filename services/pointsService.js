const Points = require('../models/points');
const { v4: uuidv4 } = require('uuid');

/**
 * Calculate points based on price and points per dollar rate
 */
function calculatePoints(price, pointsPerDollar = 10) {
    return Math.round(price * pointsPerDollar);
}

/**
 * Save a new points transaction
 */
async function savePoints({
    restaurantId,
    customerId = null,
    dishes = [],
    totalPrice = 0,
    pointsPerDollar = 10,
    notes = null
}) {
    try {
        // Validate required fields
        if (!restaurantId) {
            throw new Error('Restaurant ID is required');
        }

        if (!dishes || dishes.length === 0) {
            throw new Error('At least one dish is required');
        }

        // Calculate total points
        const totalPoints = dishes.reduce((sum, dish) => {
            const dishPoints = calculatePoints(dish.price, pointsPerDollar);
            return sum + (dishPoints * dish.quantity);
        }, 0);

        // Generate unique QR code
        const qrCode = `QR_${uuidv4().replace(/-/g, '')}`;

        // Create points record
        const pointsRecord = await Points.create({
            status: 'pending',
            restaurant_id: restaurantId,
            customer_id: customerId,
            dishes: dishes,
            total_price: totalPrice,
            total_points: totalPoints,
            points_per_dollar: pointsPerDollar,
            qr_code: qrCode,
            notes: notes
        });

        return {
            success: true,
            points: pointsRecord,
            message: 'Points transaction created successfully'
        };
    } catch (error) {
        console.error('Error saving points:', error);
        throw new Error(`Failed to save points: ${error.message}`);
    }
}

/**
 * Update points transaction status
 */
async function updatePoints(pointsId, updateData) {
    try {
        const pointsRecord = await Points.findByPk(pointsId);
        
        if (!pointsRecord) {
            throw new Error('Points transaction not found');
        }

        // Prepare update data
        const allowedUpdates = ['status', 'customer_id', 'notes'];
        const updateFields = {};
        
        allowedUpdates.forEach(field => {
            if (updateData[field] !== undefined) {
                updateFields[field] = updateData[field];
            }
        });

        // If status is being updated to 'issued', set date_issued
        if (updateFields.status === 'issued') {
            updateFields.date_issued = new Date();
        }

        // Update the record
        await pointsRecord.update(updateFields);

        return {
            success: true,
            points: pointsRecord,
            message: 'Points transaction updated successfully'
        };
    } catch (error) {
        console.error('Error updating points:', error);
        throw new Error(`Failed to update points: ${error.message}`);
    }
}

/**
 * Get points transaction by ID
 */
async function getPointsById(pointsId) {
    try {
        const pointsRecord = await Points.findByPk(pointsId);
        
        if (!pointsRecord) {
            throw new Error('Points transaction not found');
        }

        return {
            success: true,
            points: pointsRecord
        };
    } catch (error) {
        console.error('Error getting points:', error);
        throw new Error(`Failed to get points: ${error.message}`);
    }
}

/**
 * Get points transactions by restaurant ID
 */
async function getPointsByRestaurant(restaurantId, options = {}) {
    try {
        const { status, limit = 50, offset = 0 } = options;
        
        const whereClause = { restaurant_id: restaurantId };
        if (status) {
            whereClause.status = status;
        }

        const pointsRecords = await Points.findAndCountAll({
            where: whereClause,
            order: [['date_created', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        return {
            success: true,
            points: pointsRecords.rows,
            total: pointsRecords.count,
            limit: parseInt(limit),
            offset: parseInt(offset)
        };
    } catch (error) {
        console.error('Error getting points by restaurant:', error);
        throw new Error(`Failed to get points by restaurant: ${error.message}`);
    }
}

/**
 * Get points transaction by QR code
 */
async function getPointsByQrCode(qrCode) {
    try {
        const pointsRecord = await Points.findOne({
            where: { qr_code: qrCode }
        });
        
        if (!pointsRecord) {
            throw new Error('Points transaction not found');
        }

        return {
            success: true,
            points: pointsRecord
        };
    } catch (error) {
        console.error('Error getting points by QR code:', error);
        throw new Error(`Failed to get points by QR code: ${error.message}`);
    }
}

/**
 * Issue points to customer (update status to issued)
 */
async function issuePoints(pointsId, customerId = null) {
    try {
        const updateData = {
            status: 'issued',
            customer_id: customerId,
            date_issued: new Date()
        };

        return await updatePoints(pointsId, updateData);
    } catch (error) {
        console.error('Error issuing points:', error);
        throw new Error(`Failed to issue points: ${error.message}`);
    }
}

module.exports = {
    savePoints,
    updatePoints,
    getPointsById,
    getPointsByRestaurant,
    getPointsByQrCode,
    issuePoints,
    calculatePoints
};
