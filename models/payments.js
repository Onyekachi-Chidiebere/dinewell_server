const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../utils/db-connection');

/**
 * Payment model for tracking restaurant payments for points issued
 */
class Payment extends Model { };

Payment.init(
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        restaurant_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'user',
                key: 'id'
            }
        },
        restaurant_name: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        points_issued: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        payment_status: {
            type: DataTypes.ENUM('pending', 'completed', 'failed', 'reversal'),
            allowNull: false,
            defaultValue: 'pending'
        },
        payment_date: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        stripe_payment_intent_id: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        points_ids: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: [],
            // Array of point IDs that were paid for: [1, 2, 3]
        },
        type: {
            type: DataTypes.ENUM('debit', 'reversal'),
            allowNull: false,
            defaultValue: 'debit'
        },
        description: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        card_last4: {
            type: DataTypes.STRING(4),
            allowNull: true
        },
        card_brand: {
            type: DataTypes.STRING(50),
            allowNull: true
        }
    },
    {
        sequelize,
        modelName: 'payment',
        freezeTableName: true,
        timestamps: false,
        updatedAt: false
    }
);

// Define associations
Payment.associate = function(models) {
    Payment.belongsTo(models.User, {
        foreignKey: 'restaurant_id',
        as: 'restaurant'
    });
};

module.exports = Payment;