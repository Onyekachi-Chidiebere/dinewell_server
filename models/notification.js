const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../utils/db-connection');

class Notification extends Model {}

Notification.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'user',
        key: 'id',
      },
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(80),
      allowNull: false,
      defaultValue: 'general',
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    date_created: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'notification',
    freezeTableName: true,
    timestamps: false,
  }
);

Notification.associate = function (models) {
  Notification.belongsTo(models.User, {
    foreignKey: 'user_id',
    as: 'user',
  });
};

module.exports = Notification;
