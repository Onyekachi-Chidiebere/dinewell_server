const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../utils/db-connection');

/**
 * Points model for tracking point transactions
 */
class Points extends Model { };

Points.init(
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        status: {
            type: DataTypes.ENUM('pending', 'completed'),
            allowNull: false,
            defaultValue: 'pending'
        },
        type: {
            type: DataTypes.ENUM('issue', 'redeem'),
            allowNull: false,
        },
        restaurant_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'user',
                key: 'id'
            }
        },
        customer_id: {
            type: DataTypes.INTEGER,
            allowNull: true, // Can be null for anonymous transactions
            references: {
                model: 'user',
                key: 'id'
            }
        },
        dishes: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: [],
            // Structure: [{ dish_name: string, price: number, quantity: number, points: number }]
        },
        total_price: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        total_points: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        points_per_dollar: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false,
            defaultValue: 10.00
        },
        qr_code: {
            type: DataTypes.STRING(255),
            allowNull: true,
            unique: true
        },
        date_created: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        date_used: {
            type: DataTypes.DATE,
            allowNull: true
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        paid: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        payment_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'payment',
                key: 'id'
            }
        }
    },
    {
        sequelize,
        modelName: 'points',
        freezeTableName: true,
        timestamps: false,
        updatedAt: false
    }
);

// Define associations
Points.associate = function(models) {
  // Points belong to a restaurant (merchant)
  Points.belongsTo(models.User, {
    foreignKey: 'restaurant_id',
    as: 'restaurant'
  });
  
  // Points belong to a customer (optional)
  Points.belongsTo(models.User, {
    foreignKey: 'customer_id',
    as: 'customer'
  });
};

module.exports = Points;
