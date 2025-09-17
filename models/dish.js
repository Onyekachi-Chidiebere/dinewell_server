const { DataTypes } = require('sequelize');
const { sequelize } = require('../utils/db-connection');

const Dish = sequelize.define('Dish', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  restaurant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'user',
      key: 'id',
    },
  },
  dish_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  points_per_dollar: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0,
  },
  dish_image_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  base_points_per_dish: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
  },
  date_created: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  date_updated: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'dishes',
  timestamps: true,
  createdAt: 'date_created',
  updatedAt: 'date_updated',
});

module.exports = Dish;
