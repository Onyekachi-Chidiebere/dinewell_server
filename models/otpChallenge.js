const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../utils/db-connection');

class OtpChallenge extends Model {}

OtpChallenge.init({
  id: { type: DataTypes.UUID, primaryKey: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  email: { type: DataTypes.STRING(255), allowNull: false },
  account_type: { type: DataTypes.STRING(50), allowNull: false },
  purpose: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'password_reset' },
  otp_hash: { type: DataTypes.STRING(64), allowNull: false },
  attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  consumed_at: { type: DataTypes.DATE, allowNull: true },
  reset_jti_hash: { type: DataTypes.STRING(64), allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  sequelize,
  modelName: 'otp_challenge',
  freezeTableName: true,
  timestamps: false,
});

module.exports = OtpChallenge;
