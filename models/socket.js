const { DataTypes } = require('sequelize');
const { sequelize } = require('../utils/db-connection');

const Socket = sequelize.define('Socket', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'user',
      key: 'id',
    },
  },
  socket_id: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
}, {
  tableName: 'sockets',
  timestamps: true,
});

module.exports = Socket;
