const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../utils/db-connection');

class RefreshToken extends Model {}

RefreshToken.init({
  id: { type: DataTypes.UUID, primaryKey: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  family_id: { type: DataTypes.UUID, allowNull: false },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  revoked_at: { type: DataTypes.DATE, allowNull: true },
  replaced_by: { type: DataTypes.UUID, allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  sequelize,
  modelName: 'refresh_token',
  freezeTableName: true,
  timestamps: false,
});

module.exports = RefreshToken;
