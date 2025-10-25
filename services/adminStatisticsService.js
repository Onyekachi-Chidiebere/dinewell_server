const User = require('../models/user');
const Points = require('../models/points');
const { Op, fn, col , literal} = require('sequelize');
const { getTodayRange } = require('../utils/functions');

/**
 * Get restaurant statistics
 * @param {Object} filters - Date filters and other parameters
 * @returns {Object} Restaurant statistics
 */
async function getRestaurantStatistics(filters = {}) {
  try {
    const { startDate, endDate } = filters;

    let registrationStart, registrationEnd;

    if (startDate && endDate) {
      registrationStart = new Date(startDate);
      registrationEnd = new Date(endDate);
    } else {
      const now = new Date();
      registrationStart = new Date(now.getFullYear(), now.getMonth(), 1);
      registrationEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    // Get month name from registrationStart
    const monthName = registrationStart.toLocaleString('default', { month: 'long' });

    // Filter for monthly registered
    const registrationFilter = {
      date_created: { [Op.between]: [registrationStart, registrationEnd] }
    };

    // Total registered restaurants (all time)
    const totalRegistered = await User.count({
      where: { type: 'Merchant' }
    });

    // Registered in the selected month/date range
    const monthlyRegistered = await User.count({
      where: { type: 'Merchant', ...registrationFilter }
    });

    // Total active restaurants (approved)
    const totalActive = await User.count({
      where: { type: 'Merchant', approval_status: 1 }
    });

    // Total inactive restaurants (not approved)
    const totalInactive = await User.count({
      where: { type: 'Merchant', approval_status: 0 }
    });

    return {
      totalRegistered,
      monthlyRegistered,
      month: monthName,
      totalActive,
      totalInactive
    };
  } catch (error) {
    console.error('Get restaurant statistics error:', error);
    throw new Error('Failed to fetch restaurant statistics');
  }
}


/**
 * Get customer statistics
 * @param {Object} filters - Date filters and other parameters
 * @returns {Object} Customer statistics
 */
async function getCustomerStatistics(filters = {}) {
  try {
    const { startDate, endDate } = filters;

    let registrationStart, registrationEnd;

    if (startDate && endDate) {
      registrationStart = new Date(startDate);
      registrationEnd = new Date(endDate);
    } else {
      const now = new Date();
      registrationStart = new Date(now.getFullYear(), now.getMonth(), 1);
      registrationEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    // Get month name from registrationStart
    const monthName = registrationStart.toLocaleString('default', { month: 'long' });

    // Filter for monthly registered
    const registrationFilter = {
      date_created: { [Op.between]: [registrationStart, registrationEnd] }
    };

    // Total registered restaurants (all time)
    const totalRegistered = await User.count({
      where: { type: 'Customer' }
    });

    // Registered in the selected month/date range
    const monthlyRegistered = await User.count({
      where: { type: 'Customer', ...registrationFilter }
    });

    // Total active restaurants (approved)
    const totalActive = await User.count({
      where: { type: 'Customer', approval_status: 1 }
    });

    // Total inactive restaurants (not approved)
    const totalInactive = await User.count({
      where: { type: 'Customer', approval_status: 0 }
    });

    return {
      totalRegistered,
      monthlyRegistered,
      month: monthName,
      totalActive,
      totalInactive
    };
  } catch (error) {
    console.error('Get customer statistics error:', error);
    throw new Error('Failed to fetch customer statistics');
  }
}

/**
 * Get user activity graph data
 * @param {Object} filters - Date filters and other parameters
 * @returns {Array} User activity data points
 */
async function getUserActivityData(filters = {}) {
  try {
    const { startDate, endDate, days = 13 } = filters;
    
    // Generate date range
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    
    const dataPoints = [];
    
    for (let i = 0; i < days; i++) {
      const currentDate = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const nextDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      
      // Count active users for this day
      const activeUsers = await User.count({
        where: {
          date_created: {
            [Op.lt]: nextDate
          },
          approval_status: 1
        }
      });
      
      // Format date for display
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNumber = currentDate.getDate();
      const monthName = currentDate.toLocaleDateString('en-US', { month: 'short' });
      const displayName = `${dayName} ${dayNumber}${dayNumber === 1 ? 'st' : dayNumber === 2 ? 'nd' : dayNumber === 3 ? 'rd' : 'th'}`;
      
      dataPoints.push({
        name: displayName,
        value: Math.round(activeUsers / 1000) // Convert to thousands
      });
    }
    
    return dataPoints;
  } catch (error) {
    console.error('Get user activity data error:', error);
    throw new Error('Failed to fetch user activity data');
  }
}

/**
 * Get restaurant leaderboard
 * @param {Object} filters - Date filters and other parameters
 * @returns {Array} Restaurant leaderboard data
 */

async function getRestaurantLeaderboard(filters = {}) {
  const { limit = 10, startDate, endDate } = filters;

  const dateFilter = {};
  if (startDate && endDate) {
    dateFilter.date_created = { [Op.between]: [new Date(startDate), new Date(endDate)] };
  }

  try {
    const restaurants = await User.findAll({
      where: { type: 'Merchant', approval_status: 1 },
      attributes: [
        'id',
        'restaurant_name',
        'restaurant_logo',
        // Use literal with correct table references
        [literal('COALESCE(SUM("restaurantPoints"."total_points"), 0)'), 'totalPoints'],
        [literal('COUNT("restaurantPoints"."id")'), 'transactionCount']
      ],
      include: [
        {
          model: Points,
          as: 'restaurantPoints',
          attributes: [],
          where: { 
            type: 'issue', 
            status: 'completed', 
            ...dateFilter 
          },
          required: false
        }
      ],
      group: ['user.id'], // Use the actual table name 'user' (lowercase)
      order: [[literal('COALESCE(SUM("restaurantPoints"."total_points"), 0)'), 'DESC']],
      limit,
      subQuery: false
    });

    console.log({restaurants})
    return restaurants.map((r, idx) => ({
      rank: idx + 1,
      id: r.id,
      name: r.restaurant_name,
      logo: r.restaurant_logo,
      totalPoints: parseInt(r.dataValues.totalPoints) || 0,
      transactionCount: parseInt(r.dataValues.transactionCount) || 0
    }));
  } catch (error) {
    console.error('Get restaurant leaderboard error:', error);
    throw new Error('Failed to fetch restaurant leaderboard');
  }
}



/**
 * Get customer leaderboard
 * @param {Object} filters - Date filters and other parameters
 * @returns {Array} Customer leaderboard data
 */
async function getCustomerLeaderboard(filters = {}) {
  try {
    const { limit = 10, startDate, endDate } = filters;

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.date_used = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    const customers = await User.findAll({
      where: { type: 'Customer', approval_status: 1 },
      attributes: [
        'id',
        'name',
        // Use customerPoints association instead of restaurantPoints
        [literal('COALESCE(SUM("customerPoints"."total_points"), 0)'), 'totalPoints'],
        [literal('COUNT("customerPoints"."id")'), 'transactionCount']
      ],
      include: [
        {
          model: Points,
          as: 'customerPoints', // Use customerPoints instead of restaurantPoints
          attributes: [],
          where: { 
            type: 'issue', 
            status: 'completed', 
            ...dateFilter 
          },
          required: false
        }
      ],
      group: ['user.id'],
      order: [[literal('COALESCE(SUM("customerPoints"."total_points"), 0)'), 'DESC']],
      limit,
      subQuery: false
    });

    return customers.map((r, idx) => ({
      rank: idx + 1,
      id: r.id,
      name: r.name,
      totalPoints: parseInt(r.dataValues.totalPoints) || 0,
      transactionCount: parseInt(r.dataValues.transactionCount) || 0
    }));
  } catch (error) {
    console.error('Get customer leaderboard error:', error);
    throw new Error('Failed to fetch customer leaderboard');
  }
}




/**
 * Get points graph data
 * @param {Object} filters - Date filters and other parameters
 * @returns {Object} Points graph data
 */
async function getPointsGraphData(filters = {}) {
  try {
    const { startDate, endDate, days = 13 } = filters;
    
    // Generate date range
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    
    const dataPoints = [];
    
    for (let i = 0; i < days; i++) {
      const currentDate = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const nextDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      
      // Get points issued for this day
      const pointsIssued = await Points.sum('total_points', {
        where: {
          type: 'issue',
          status: 'completed',
          date_used: {
            [Op.between]: [currentDate, nextDate]
          }
        }
      });
      
      // Get points redeemed for this day
      const pointsRedeemed = await Points.sum('total_points', {
        where: {
          type: 'redeem',
          status: 'completed',
          date_used: {
            [Op.between]: [currentDate, nextDate]
          }
        }
      });
      
      // Format date for display
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNumber = currentDate.getDate();
      const displayName = `${dayName} ${dayNumber}${dayNumber === 1 ? 'st' : dayNumber === 2 ? 'nd' : dayNumber === 3 ? 'rd' : 'th'}`;
      
      dataPoints.push({
        name: displayName,
        pointsIssued: Math.round((pointsIssued || 0) / 1000000), // Convert to millions
        pointsRedeemed: Math.round((pointsRedeemed || 0) / 1000000) // Convert to millions
      });
    }
    
    return dataPoints;
  } catch (error) {
    console.error('Get points graph data error:', error);
    throw new Error('Failed to fetch points graph data');
  }
}

/**
 * Get dashboard overview statistics
 * @param {Object} filters - Date filters and other parameters
 * @returns {Object} Dashboard overview
 */
async function getDashboardOverview(filters = {}) {
  try {
    const [restaurantStats, customerStats, userActivity, restaurantLeaderboard, customerLeaderboard, pointsData] = await Promise.all([
      getRestaurantStatistics(filters),
      getCustomerStatistics(filters),
      getUserActivityData(filters),
      getRestaurantLeaderboard({ ...filters, limit: 10 }),
      getCustomerLeaderboard({ ...filters, limit: 10 }),
      getPointsGraphData(filters)
    ]);

    return {
      restaurants: restaurantStats,
      customers: customerStats,
      userActivity,
      restaurantLeaderboard,
      customerLeaderboard,
      pointsData
    };
  } catch (error) {
    console.error('Get dashboard overview error:', error);
    throw new Error('Failed to fetch dashboard overview');
  }
}

module.exports = {
  getRestaurantStatistics,
  getCustomerStatistics,
  getUserActivityData,
  getRestaurantLeaderboard,
  getCustomerLeaderboard,
  getPointsGraphData,
  getDashboardOverview
};
