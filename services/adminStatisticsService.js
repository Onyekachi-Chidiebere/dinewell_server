const User = require('../models/user');
const Points = require('../models/points');
const { Op, fn, col, literal } = require('sequelize');

const APPROVAL = {
  PENDING: 0,
  APPROVED: 1,
  DISABLED: -1,
};

function pendingApprovalWhere() {
  return {
    [Op.or]: [{ approval_status: APPROVAL.PENDING }, { approval_status: null }],
  };
}

function resolveRegistrationRange(filters = {}) {
  const { startDate, endDate } = filters;

  if (startDate && endDate) {
    const registrationStart = new Date(startDate);
    const registrationEnd = new Date(endDate);
    registrationEnd.setHours(23, 59, 59, 999);
    const periodLabel = `${registrationStart.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })} – ${registrationEnd.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
    return {
      registrationStart,
      registrationEnd,
      periodLabel,
    };
  }

  const now = new Date();
  const registrationStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const registrationEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const periodLabel = registrationStart.toLocaleString('default', { month: 'long' });

  return { registrationStart, registrationEnd, periodLabel };
}

function resolveDayCount(filters = {}, defaultDays = 13) {
  const { startDate, endDate } = filters;
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)) + 1);
  }
  return defaultDays;
}

function formatChartLabel(currentDate) {
  const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNumber = currentDate.getDate();
  const suffix =
    dayNumber === 1 || dayNumber === 21 || dayNumber === 31
      ? 'st'
      : dayNumber === 2 || dayNumber === 22
        ? 'nd'
        : dayNumber === 3 || dayNumber === 23
          ? 'rd'
          : 'th';
  return `${dayName} ${dayNumber}${suffix}`;
}

async function getRestaurantStatistics(filters = {}) {
  try {
    const { registrationStart, registrationEnd, periodLabel } = resolveRegistrationRange(filters);

    const registrationFilter = {
      date_created: { [Op.between]: [registrationStart, registrationEnd] },
    };

    const [totalRegistered, monthlyRegistered, totalActive, totalPending, totalDisabled] =
      await Promise.all([
        User.count({ where: { type: 'Merchant' } }),
        User.count({ where: { type: 'Merchant', ...registrationFilter } }),
        User.count({ where: { type: 'Merchant', approval_status: APPROVAL.APPROVED } }),
        User.count({ where: { type: 'Merchant', ...pendingApprovalWhere() } }),
        User.count({ where: { type: 'Merchant', approval_status: APPROVAL.DISABLED } }),
      ]);

    return {
      totalRegistered,
      monthlyRegistered,
      month: periodLabel,
      totalActive,
      totalPending,
      totalDisabled,
      // Backward compatibility for older clients
      totalInactive: totalPending,
    };
  } catch (error) {
    console.error('Get restaurant statistics error:', error);
    throw new Error('Failed to fetch restaurant statistics');
  }
}

async function getCustomerStatistics(filters = {}) {
  try {
    const { registrationStart, registrationEnd, periodLabel } = resolveRegistrationRange(filters);

    const registrationFilter = {
      date_created: { [Op.between]: [registrationStart, registrationEnd] },
    };

    const [totalRegistered, monthlyRegistered, customersWithPointsRow] = await Promise.all([
      User.count({ where: { type: 'Customer' } }),
      User.count({ where: { type: 'Customer', ...registrationFilter } }),
      Points.findAll({
        attributes: [[fn('COUNT', fn('DISTINCT', col('customer_id'))), 'count']],
        where: {
          customer_id: { [Op.ne]: null },
          status: 'completed',
        },
        raw: true,
      }),
    ]);

    const customersWithPoints = Number(customersWithPointsRow[0]?.count || 0);

    return {
      totalRegistered,
      monthlyRegistered,
      month: periodLabel,
      totalActive: customersWithPoints,
      customersWithPoints,
      totalInactive: Math.max(totalRegistered - customersWithPoints, 0),
    };
  } catch (error) {
    console.error('Get customer statistics error:', error);
    throw new Error('Failed to fetch customer statistics');
  }
}

async function getUserActivityData(filters = {}) {
  try {
    const days = resolveDayCount(filters, filters.days || 13);
    const end = filters.endDate ? new Date(filters.endDate) : new Date();
    end.setHours(23, 59, 59, 999);
    const start = filters.startDate
      ? new Date(filters.startDate)
      : new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);

    const dataPoints = [];

    for (let i = 0; i < days; i++) {
      const currentDate = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const nextDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);

      const newUsers = await User.count({
        where: {
          type: { [Op.in]: ['Merchant', 'Customer'] },
          date_created: {
            [Op.gte]: currentDate,
            [Op.lt]: nextDate,
          },
        },
      });

      dataPoints.push({
        name: formatChartLabel(currentDate),
        value: newUsers,
      });
    }

    return dataPoints;
  } catch (error) {
    console.error('Get user activity data error:', error);
    throw new Error('Failed to fetch user activity data');
  }
}

async function getRestaurantLeaderboard(filters = {}) {
  const { limit = 10, startDate, endDate } = filters;

  const dateFilter = {};
  if (startDate && endDate) {
    dateFilter.date_used = { [Op.between]: [new Date(startDate), new Date(endDate)] };
  }

  try {
    const restaurants = await User.findAll({
      where: { type: 'Merchant', approval_status: APPROVAL.APPROVED },
      attributes: [
        'id',
        'restaurant_name',
        'restaurant_logo',
        [literal('COALESCE(SUM("restaurantPoints"."total_points"), 0)'), 'totalPoints'],
        [literal('COUNT("restaurantPoints"."id")'), 'transactionCount'],
      ],
      include: [
        {
          model: Points,
          as: 'restaurantPoints',
          attributes: [],
          where: {
            type: 'issue',
            status: 'completed',
            ...dateFilter,
          },
          required: false,
        },
      ],
      group: ['user.id'],
      order: [[literal('COALESCE(SUM("restaurantPoints"."total_points"), 0)'), 'DESC']],
      limit,
      subQuery: false,
    });

    return restaurants
      .map((r, idx) => ({
        rank: idx + 1,
        id: r.id,
        name: r.restaurant_name,
        logo: r.restaurant_logo,
        totalPoints: parseInt(r.dataValues.totalPoints, 10) || 0,
        transactionCount: parseInt(r.dataValues.transactionCount, 10) || 0,
      }))
      .filter((r) => r.totalPoints > 0)
      .map((r, idx) => ({ ...r, rank: idx + 1 }));
  } catch (error) {
    console.error('Get restaurant leaderboard error:', error);
    throw new Error('Failed to fetch restaurant leaderboard');
  }
}

async function getCustomerLeaderboard(filters = {}) {
  try {
    const { limit = 10, startDate, endDate } = filters;

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.date_used = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    const customers = await User.findAll({
      where: { type: 'Customer' },
      attributes: [
        'id',
        'name',
        [literal('COALESCE(SUM("customerPoints"."total_points"), 0)'), 'totalPoints'],
        [literal('COUNT("customerPoints"."id")'), 'transactionCount'],
      ],
      include: [
        {
          model: Points,
          as: 'customerPoints',
          attributes: [],
          where: {
            type: 'issue',
            status: 'completed',
            ...dateFilter,
          },
          required: false,
        },
      ],
      group: ['user.id'],
      order: [[literal('COALESCE(SUM("customerPoints"."total_points"), 0)'), 'DESC']],
      limit,
      subQuery: false,
    });

    return customers
      .map((r, idx) => ({
        rank: idx + 1,
        id: r.id,
        name: r.name,
        totalPoints: parseInt(r.dataValues.totalPoints, 10) || 0,
        transactionCount: parseInt(r.dataValues.transactionCount, 10) || 0,
      }))
      .filter((r) => r.totalPoints > 0)
      .map((r, idx) => ({ ...r, rank: idx + 1 }));
  } catch (error) {
    console.error('Get customer leaderboard error:', error);
    throw new Error('Failed to fetch customer leaderboard');
  }
}

async function getPointsGraphData(filters = {}) {
  try {
    const days = resolveDayCount(filters, filters.days || 13);
    const end = filters.endDate ? new Date(filters.endDate) : new Date();
    end.setHours(23, 59, 59, 999);
    const start = filters.startDate
      ? new Date(filters.startDate)
      : new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);

    const dataPoints = [];

    for (let i = 0; i < days; i++) {
      const currentDate = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const nextDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);

      const [pointsIssued, pointsRedeemed] = await Promise.all([
        Points.sum('total_points', {
          where: {
            type: 'issue',
            status: 'completed',
            date_used: {
              [Op.gte]: currentDate,
              [Op.lt]: nextDate,
            },
          },
        }),
        Points.sum('total_points', {
          where: {
            type: 'redeem',
            status: 'completed',
            date_used: {
              [Op.gte]: currentDate,
              [Op.lt]: nextDate,
            },
          },
        }),
      ]);

      dataPoints.push({
        name: formatChartLabel(currentDate),
        pointsIssued: Number(pointsIssued || 0),
        pointsRedeemed: Number(pointsRedeemed || 0),
      });
    }

    return dataPoints;
  } catch (error) {
    console.error('Get points graph data error:', error);
    throw new Error('Failed to fetch points graph data');
  }
}

async function getDashboardOverview(filters = {}) {
  try {
    const leaderboardLimit = filters.limit || 10;
    const [
      restaurantStats,
      customerStats,
      userActivity,
      restaurantLeaderboard,
      customerLeaderboard,
      pointsData,
    ] = await Promise.all([
      getRestaurantStatistics(filters),
      getCustomerStatistics(filters),
      getUserActivityData(filters),
      getRestaurantLeaderboard({ ...filters, limit: leaderboardLimit }),
      getCustomerLeaderboard({ ...filters, limit: leaderboardLimit }),
      getPointsGraphData(filters),
    ]);

    return {
      restaurants: restaurantStats,
      customers: customerStats,
      userActivity,
      restaurantLeaderboard,
      customerLeaderboard,
      pointsData,
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
  getDashboardOverview,
};
