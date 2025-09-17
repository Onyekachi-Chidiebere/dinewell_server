

const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

//this initalizes the environment variables;
dotenv.config();

const DB = process.env.DB;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_PORT = process.env.DB_PORT;
const DB_DIALECT = process.env.DB_DIALECT;
const DB_HOST = process.env.DB_HOST;

//Initalize sequelize;
const sequelize = new Sequelize(DB, DB_USER, DB_PASSWORD,
    {
        host: DB_HOST,
        dialect: DB_DIALECT,
        port: DB_PORT,
        dialectModule: require('pg'),
        
    });

/**
 * This handles the database connection to mysql using sequlize;
 */
const dbConnection = async () => {
    try {
        //connect app to sql database;
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

    } catch (error) {
        console.error('Unable to connect to the database:', error);

    }

};

//export the connections;
module.exports = {
    dbConnection,
    sequelize,
}
