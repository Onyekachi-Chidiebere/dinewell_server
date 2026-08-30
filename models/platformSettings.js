const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../utils/db-connection');

/**
 * Singleton platform settings for points rates and debt limit.
 * Always use id = 1.
 */
class PlatformSettings extends Model {}

PlatformSettings.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: false,
      defaultValue: 1,
    },
    // Customer loyalty: points earned per $1 spent
    customer_earn_rate: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
      defaultValue: 10,
    },
    // Customer loyalty: points spent per $1 redeemed
    customer_redeem_rate: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
      defaultValue: 500,
    },
    // What restaurants pay DineWell per issued point ($)
    merchant_billing_rate: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
      defaultValue: 0.1,
    },
    // Global max unpaid issued-points debt in USD before block
    debt_limit_usd: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 100,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'platform_settings',
    freezeTableName: true,
    timestamps: false,
  }
);

module.exports = PlatformSettings;
