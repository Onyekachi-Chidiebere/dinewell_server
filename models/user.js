const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../utils/db-connection');

/**
 * this is user model
 */
class User extends Model { };

User.init(
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        stripe_id: {
            type: DataTypes.STRING(255)
        },
        restaurant_name: {
            type: DataTypes.STRING(255)
        },
        
        name: {
            type: DataTypes.STRING(255)
        },
      
        phone: {
            type: DataTypes.STRING(255)
        },
        email: {
            type: DataTypes.STRING(255)
        },
        account_name: {
            type: DataTypes.STRING(255)
        },

        bank_name: {
            type: DataTypes.STRING(255)
        },
        
        account_number: {
            type: DataTypes.STRING(255)
        },
        bank_code: {
            type: DataTypes.STRING(255)
        },
        type: {
            //ADMIN; Merchant; Customer;
            type: DataTypes.STRING(255)
        },
        password: {
            type: DataTypes.STRING(255)
        },
        approval_status: {
            //2 -  NOT APPROVED; 1 - APPROVED; 0 - PENDING;
            type: DataTypes.INTEGER,
            default:0
        },
        date_created: {
            type: DataTypes.DATE,
        },
        phone_verification_date: {
            type: DataTypes.DATE,
        },
        email_verification_date: {
            type: DataTypes.DATE,
        },
        date_approved: {
            type: DataTypes.DATE,
        },
        regions: {
            type: DataTypes.JSONB,
            allowNull: true,
            // {id:1, price:1000}
            defaultValue: [],
        },
        payment_cards: {
            type: DataTypes.JSONB,
            allowNull: true,
            // { "id": "pm_abc1", "last4": "4242", "brand": "visa" },
            defaultValue: [],
        },
        default_payment_card_id:{
            type: DataTypes.STRING(255)
        },
        cash_payment:{
            type: DataTypes.BOOLEAN,
            defaultValue:true
        },
        wallet_amount:{
            type: DataTypes.INTEGER,
            defaultValue:0
        },
        pending_wallet_amount:{
            type: DataTypes.INTEGER,
            default:0
        },
        restaurant_logo: {
            type: DataTypes.STRING(255)
        },
        restaurant_images: {
            type: DataTypes.JSONB,
            defaultValue: []
        },
        // Client-specific fields
        username: {
            type: DataTypes.STRING(255),
            unique: true
        },
        date_of_birth: {
            type: DataTypes.DATE
        },
        gender: {
            type: DataTypes.STRING(50)
        },
        provider: {
            type: DataTypes.STRING(50) // 'google', 'apple', 'email'
        },
        provider_id: {
            type: DataTypes.STRING(255) // Provider's user ID
        },
        profile_image: {
            type: DataTypes.STRING(500)
        }

    },
    {
        sequelize,
        modelName: 'user',
        freezeTableName: true,
        timestamps: false,
        updatedAt: false
    }
);

module.exports = User;