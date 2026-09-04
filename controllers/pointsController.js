const pointsService = require('../services/pointsService');
const SocketModel = require('../models/socket');

/**
 * Create a new points transaction
 */
exports.createPoints = async (req, res) => {
    try {
        const {
            type,
            restaurantId,
            customerId,
            dishes,
            totalPrice,
            notes
        } = req.body;

        // Validate required fields
        if (!restaurantId) {
            return res.status(400).json({ 
                error: 'Restaurant ID is required' 
            });
        }
        if (!type) {
            return res.status(400).json({ 
                error: 'Points type' 
            });
        }
        if (!dishes || dishes.length === 0) {
            return res.status(400).json({ 
                error: 'At least one dish is required' 
            });
        }

        // Validate dishes structure
        for (const dish of dishes) {
            if (!dish.name || !dish.price || !dish.quantity) {
                return res.status(400).json({ 
                    error: 'Each dish must have name, price, and quantity' 
                });
            }
        }

        const result = await pointsService.savePoints({
            type,
            restaurantId,
            customerId,
            dishes,
            totalPrice,
            notes
        });

        res.status(201).json(result);
    } catch (err) {
        console.error('Create points error:', err);
        const status = err.code === 'POINTS_BLOCKED' ? 403 : 400;
        res.status(status).json({ 
            error: err.message || 'Failed to create points transaction',
            code: err.code || undefined,
            billing: err.billing || undefined,
        });
    }
};

/**
 * Update points transaction
 */
exports.updatePoints = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (!id) {
            return res.status(400).json({ 
                error: 'Points ID is required' 
            });
        }

        const result = await pointsService.updatePoints(id, updateData);
        res.json(result);
    } catch (err) {
        console.error('Update points error:', err);
        res.status(400).json({ 
            error: err.message || 'Failed to update points transaction' 
        });
    }
};

/**
 * Get points transaction by ID
 */
exports.getPointsById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ 
                error: 'Points ID is required' 
            });
        }

        const result = await pointsService.getPointsById(id);
        res.json(result);
    } catch (err) {
        console.error('Get points by ID error:', err);
        res.status(404).json({ 
            error: err.message || 'Points transaction not found' 
        });
    }
};

/**
 * Get points transactions by restaurant
 */
exports.getPointsByRestaurant = async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { status, limit = 50, offset = 0 } = req.query;

        if (!restaurantId) {
            return res.status(400).json({ 
                error: 'Restaurant ID is required' 
            });
        }

        const result = await pointsService.getPointsByRestaurant(restaurantId, {
            status,
            limit,
            offset
        });

        res.json(result);
    } catch (err) {
        console.error('Get points by restaurant error:', err);
        res.status(400).json({ 
            error: err.message || 'Failed to get points transactions' 
        });
    }
};

/**
 * Get points transaction by QR code
 */
exports.getPointsByQrCode = async (req, res) => {
    try {
        const { qrCode } = req.params;

        if (!qrCode) {
            return res.status(400).json({ 
                error: 'QR code is required' 
            });
        }

        const result = await pointsService.getPointsByQrCode(qrCode);
        res.json(result);
    } catch (err) {
        console.error('Get points by QR code error:', err);
        res.status(404).json({ 
            error: err.message || 'Points transaction not found' 
        });
    }
};

/**
 * Issue points to customer
 */
exports.issuePoints = async (req, res) => {
    try {
        const { id } = req.params;
        const { customerId } = req.body;

        if (!id) {
            return res.status(400).json({ 
                error: 'Points ID is required' 
            });
        }

        const result = await pointsService.issuePoints(id, customerId);
        res.json(result);
    } catch (err) {
        console.error('Issue points error:', err);
        res.status(400).json({ 
            error: err.message || 'Failed to issue points' 
        });
    }
};

/**
 * Scan QR code and issue points
 */
exports.scanQrCode = async (req, res) => {
    try {
        const { qrCode } = req.params;
        const { customerId } = req.body;

        if (!qrCode) {
            return res.status(400).json({ 
                error: 'QR code is required' 
            });
        }

        // Get points transaction by QR code
        const pointsResult = await pointsService.getPointsByQrCode(qrCode);
        
        if (pointsResult.points.status !== 'pending') {
            return res.status(400).json({ 
                error: 'Points have already been issued for this QR code' 
            });
        }

        // Issue the points
        const result = await pointsService.issuePoints(pointsResult.points.id, customerId);
        const pointsRecord = result.points || pointsResult.points;
        const pointType = pointsRecord.type;
        const totalPoints = pointsRecord.total_points;

        // Notify merchant directly via stored socket id (existing realtime UX — keep intact)
        try {
            const io = req.app.get('io');
            if (io) {
                const restaurantUserId = pointsResult.points.restaurant_id;
                const restaurantSocket = await SocketModel.findOne({ where: { user_id: restaurantUserId } });
              
                if (restaurantSocket && restaurantSocket.socket_id) {
                    io.to(restaurantSocket.socket_id).emit('points:completed', {
                        pointsId: pointsResult.points.id,
                        restaurantId: restaurantUserId,
                        type: pointType,
                        qrCode: pointsResult.points.qr_code,
                        customerId: customerId || null,
                        status: 'issued',
                        dateIssued: new Date().toISOString()
                    });
                }
            }
        } catch (emitErr) {
            console.error('Socket emit error:', emitErr);
        }

        // In-app inbox notifications (additive — does not replace socket)
        try {
            const notificationService = require('../services/notificationService');
            const restaurantId = pointsResult.points.restaurant_id;

            if (restaurantId) {
                await notificationService.createNotification({
                    userId: restaurantId,
                    title: pointType === 'redeem' ? 'Points redeemed' : 'Points issued',
                    body:
                        pointType === 'redeem'
                            ? `A customer redeemed ${totalPoints} points at your restaurant.`
                            : `A customer earned ${totalPoints} points at your restaurant.`,
                    type: 'points_completed',
                    data: {
                        pointsId: pointsResult.points.id,
                        type: pointType,
                        customerId: customerId || null,
                    },
                });
            }

            if (customerId) {
                await notificationService.createNotification({
                    userId: customerId,
                    title: pointType === 'redeem' ? 'Points redeemed' : 'Points earned',
                    body:
                        pointType === 'redeem'
                            ? `You redeemed ${totalPoints} points.`
                            : `You earned ${totalPoints} points.`,
                    type: 'points_completed',
                    data: {
                        pointsId: pointsResult.points.id,
                        type: pointType,
                        restaurantId,
                    },
                });
            }
        } catch (notifyErr) {
            console.error('Points inbox notification error:', notifyErr);
        }

        res.json(result);
    } catch (err) {
        console.error('Scan QR code error:', err);
        res.status(400).json({ 
            error: err.message || 'Failed to scan QR code and issue points' 
        });
    }
};

// Get all points for admin
exports.getPointsForAdmin = async (req, res) => {
    try {
        const { page = 1, limit = 10, type = 'all' } = req.query;
        const result = await pointsService.getPointsForAdmin(parseInt(page), parseInt(limit), type);
        res.json(result);
    } catch (err) {
        console.error('Get points for admin error:', err);
        res.status(400).json({ 
            error: err.message || 'Failed to get points for admin' 
        });
    }
};

/**
 * Get points rate configuration
 */
exports.getPointsRate = async (req, res) => {
    try {
        const pointsRate = await pointsService.getPointsRate();
        res.json(pointsRate);
    } catch (err) {
        console.error('Get points rate error:', err);
        res.status(400).json({ 
            error: err.message || 'Failed to get points rate' 
        });
    }
};

/**
 * Get points history for merchant (grouped by date)
 */
exports.getPointsHistoryForMerchant = async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { searchQuery = '' } = req.query;

        if (!restaurantId) {
            return res.status(400).json({ 
                error: 'Restaurant ID is required' 
            });
        }

        const result = await pointsService.getPointsHistoryForMerchant(restaurantId, searchQuery);
        res.json(result);
    } catch (err) {
        console.error('Get points history for merchant error:', err);
        res.status(400).json({ 
            error: err.message || 'Failed to get points history' 
        });
    }
};
