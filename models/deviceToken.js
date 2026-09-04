const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../utils/db-connection');

class DeviceToken extends Model {}

DeviceToken.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING(512),
      allowNull: false,
      unique: true,
    },
    platform: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'unknown',
    },
    app: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    date_updated: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'device_token',
    freezeTableName: true,
    timestamps: false,
  }
);

DeviceToken.associate = function (models) {
  if (models.User) {
    DeviceToken.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  }
};

module.exports = DeviceToken;
