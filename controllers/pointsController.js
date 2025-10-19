const pointsService = require('../services/pointsService');

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
            pointsPerDollar = 10,
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
            pointsPerDollar,
            notes
        });

        res.status(201).json(result);
    } catch (err) {
        console.error('Create points error:', err);
        res.status(400).json({ 
            error: err.message || 'Failed to create points transaction' 
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

        // Notify merchant room via Socket.IO
        try {
            const io = req.app.get('io');
            if (io) {
                const restaurantRoom = `restaurant:${pointsResult.points.restaurant_id}`;
                io.to(restaurantRoom).emit('points:completed', {
                    pointsId: pointsResult.points.id,
                    restaurantId: pointsResult.points.restaurant_id,
                    type: pointsResult.points.type,
                    qrCode: pointsResult.points.qr_code,
                    customerId: customerId || null,
                    status: 'issued',
                    dateIssued: new Date().toISOString()
                });
            }
        } catch (emitErr) {
            console.error('Socket emit error:', emitErr);
        }

        res.json(result);
    } catch (err) {
        console.error('Scan QR code error:', err);
        res.status(400).json({ 
            error: err.message || 'Failed to scan QR code and issue points' 
        });
    }
};
