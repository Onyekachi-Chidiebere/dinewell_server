const Points = require('../models/points');
const { v4: uuidv4 } = require('uuid');
const POINTS_RATE = {
    issue: 10, // 10 points per doller
    redeem: 500 // 500 points per dollar
}

/**
 * Calculate points based on price and points per dollar rate
 */
function calculatePoints(price, type) {
    let pointsPerDollar = POINTS_RATE[type]
    return Math.round(price * pointsPerDollar);
}

/**
 * Save a new points transaction
 */
async function savePoints({
    restaurantId,
    type,
    customerId = null,
    dishes = [],
    totalPrice = 0,
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
            const dishPoints = calculatePoints(dish.price, type);
            return sum + (dishPoints * dish.quantity);
        }, 0);

        // Generate unique QR code
        const qrCode = `QR_${uuidv4().replace(/-/g, '')}`;

        // Create points record
        const pointsRecord = await Points.create({
            status: 'pending',
            type,
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
        const allowedUpdates = ['status', 'date_used', 'customer_id', 'notes'];
        const updateFields = {};

        allowedUpdates.forEach(field => {
            if (updateData[field] !== undefined) {
                updateFields[field] = updateData[field];
            }
        });

        // If status is being updated to 'issued', set date_issued
        if (updateFields.status === 'completed') {
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
 * Issue points to customer (update status to completed)
 */
async function issuePoints(pointsId, customerId = null) {
    try {
        const updateData = {
            status: 'completed',
            customer_id: customerId,
            date_used: new Date()
        };

        return await updatePoints(pointsId, updateData);
    } catch (error) {
        console.error('Error issuing points:', error);
        throw new Error(`Failed to issue points: ${error.message}`);
    }
}

const User = require('../models/user');
const { Op, fn, col } = require('sequelize');

/**
 * Get all points for admin with statistics and pagination
 */
async function getPointsForAdmin(page = 1, limit = 10, filterType = 'all') {
    try {
        const offset = (page - 1) * limit;

        // Build where clause based on filter type
        const baseWhere = { status: 'completed' };
        const filteredWhere = { ...baseWhere };

        if (filterType === 'issued') {
            filteredWhere.type = 'issue';
        } else if (filterType === 'redeemed') {
            filteredWhere.type = 'redeem';
        }

        // Get total count of all points
        const totalPoints = await Points.count({
            where: baseWhere
        });

        // Get total count of issued points
        const totalIssued = await Points.count({
            where: {
                ...baseWhere,
                type: 'issue'
            }
        });

        // Get total count of redeemed points
        const totalRedeemed = await Points.count({
            where: {
                ...baseWhere,
                type: 'redeem'
            }
        });

        // Get filtered count based on filter type
        const filteredCount = await Points.count({
            where: filteredWhere
        });

        // Get paginated points with filter
        const points = await Points.findAll({
            where: filteredWhere,
            attributes: [
                'id',
                'restaurant_id',
                'customer_id',
                'total_points',
                'type',
                'date_used',
                'date_created'
            ],
            order: [['date_used', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset),
            raw: true
        });

        // Get unique restaurant IDs
        const restaurantIds = [...new Set(points.map(p => p.restaurant_id))];

        // Get unique customer IDs
        const customerIds = [...new Set(points.map(p => p.customer_id).filter(Boolean))];

        // Get restaurant names
        const restaurants = await User.findAll({
            where: {
                id: { [Op.in]: restaurantIds },
                type: 'Merchant'
            },
            attributes: [
                'id',
                'restaurant_name'
            ],
            raw: true
        });

        // Get customer names
        const customers = await User.findAll({
            where: {
                id: { [Op.in]: customerIds },
                type: 'Customer'
            },
            attributes: [
                'id',
                'name'
            ],
            raw: true
        });

        // Create maps for quick lookup
        const restaurantMap = {};
        restaurants.forEach(r => {
            restaurantMap[r.id] = r.restaurant_name;
        });

        const customerMap = {};
        customers.forEach(c => {
            customerMap[c.id] = c.name;
        });

        // Format points data
        const formattedPoints = points.map(point => ({
            id: point.id,
            restaurant_name: restaurantMap[point.restaurant_id] || 'Unknown Restaurant',
            customer_name: point.customer_id ? (customerMap[point.customer_id] || 'Unknown Customer') : 'N/A',
            points: point.total_points,
            type: point.type,
            date_used: point.date_used
        }));

        return {
            statistics: {
                total_points: totalPoints,
                total_used: totalIssued,
                total_redeemed: totalRedeemed
            },
            points: formattedPoints,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(filteredCount / limit),
                totalItems: filteredCount,
                itemsPerPage: parseInt(limit)
            }
        };
    } catch (error) {
        console.error('Error getting points for admin:', error);
        throw new Error(`Failed to get points for admin: ${error.message}`);
    }
}

module.exports = {
    savePoints,
    updatePoints,
    getPointsById,
    getPointsByRestaurant,
    getPointsByQrCode,
    issuePoints,// manages both issue and redeem points
    calculatePoints,
    getPointsForAdmin
};
