const adminStatisticsService = require('../services/adminStatisticsService');

/**
 * Get restaurant statistics
 * GET /admin/statistics/restaurants
 */
exports.getRestaurantStatistics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const filters = {};
    if (startDate && endDate) {
      filters.startDate = startDate;
      filters.endDate = endDate;
    }

    const statistics = await adminStatisticsService.getRestaurantStatistics(filters);
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Get restaurant statistics error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch restaurant statistics'
    });
  }
};

/**
 * Get customer statistics
 * GET /admin/statistics/customers
 */
exports.getCustomerStatistics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const filters = {};
    if (startDate && endDate) {
      filters.startDate = startDate;
      filters.endDate = endDate;
    }

    const statistics = await adminStatisticsService.getCustomerStatistics(filters);
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Get customer statistics error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch customer statistics'
    });
  }
};

/**
 * Get user activity data
 * GET /admin/statistics/user-activity
 */
exports.getUserActivityData = async (req, res) => {
  try {
    const { startDate, endDate, days } = req.query;
    
    const filters = {};
    if (startDate && endDate) {
      filters.startDate = startDate;
      filters.endDate = endDate;
    }
    if (days) {
      filters.days = parseInt(days);
    }

    const data = await adminStatisticsService.getUserActivityData(filters);
    
    res.json({
      success: true,
      data: {
        name: 'User Activity',
        color: '#5D47C1',
        data: data
      }
    });
  } catch (error) {
    console.error('Get user activity data error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch user activity data'
    });
  }
};

/**
 * Get restaurant leaderboard
 * GET /admin/statistics/restaurant-leaderboard
 */
exports.getRestaurantLeaderboard = async (req, res) => {
  try {
    const { startDate, endDate, limit } = req.query;
    
    const filters = {};
    if (startDate && endDate) {
      filters.startDate = startDate;
      filters.endDate = endDate;
    }
    if (limit) {
      filters.limit = parseInt(limit);
    }

    const leaderboard = await adminStatisticsService.getRestaurantLeaderboard(filters);
    
    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    console.error('Get restaurant leaderboard error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch restaurant leaderboard'
    });
  }
};

/**
 * Get customer leaderboard
 * GET /admin/statistics/customer-leaderboard
 */
exports.getCustomerLeaderboard = async (req, res) => {
  try {
    const { startDate, endDate, limit } = req.query;
    
    const filters = {};
    if (startDate && endDate) {
      filters.startDate = startDate;
      filters.endDate = endDate;
    }
    if (limit) {
      filters.limit = parseInt(limit);
    }

    const leaderboard = await adminStatisticsService.getCustomerLeaderboard(filters);
    
    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    console.error('Get customer leaderboard error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch customer leaderboard'
    });
  }
};

/**
 * Get points graph data
 * GET /admin/statistics/points-graph
 */
exports.getPointsGraphData = async (req, res) => {
  try {
    const { startDate, endDate, days } = req.query;
    
    const filters = {};
    if (startDate && endDate) {
      filters.startDate = startDate;
      filters.endDate = endDate;
    }
    if (days) {
      filters.days = parseInt(days);
    }

    const data = await adminStatisticsService.getPointsGraphData(filters);
    
    res.json({
      success: true,
      data: {
        pointsIssued: {
          name: 'Points Issued',
          color: '#EF7013',
          data: data.map(item => ({ name: item.name, value: item.pointsIssued }))
        },
        pointsRedeemed: {
          name: 'Points Redeemed',
          color: '#5D47C1',
          data: data.map(item => ({ name: item.name, value: item.pointsRedeemed }))
        }
      }
    });
  } catch (error) {
    console.error('Get points graph data error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch points graph data'
    });
  }
};

/**
 * Get dashboard overview
 * GET /admin/statistics/dashboard-overview
 */
exports.getDashboardOverview = async (req, res) => {
  try {
    const { startDate, endDate, days, limit } = req.query;
    
    const filters = {};
    if (startDate && endDate) {
      filters.startDate = startDate;
      filters.endDate = endDate;
    }
    if (days) {
      filters.days = parseInt(days);
    }
    if (limit) {
      filters.limit = parseInt(limit);
    }

    const overview = await adminStatisticsService.getDashboardOverview(filters);
    
    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    console.error('Get dashboard overview error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch dashboard overview'
    });
  }
};
