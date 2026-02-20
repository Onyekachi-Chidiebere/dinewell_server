

const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const fs = require('fs'); // <--- need this to read certificate file
const path = require('path')

//this initalizes the environment variables;
dotenv.config();

const DB = process.env.DB;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_PORT = process.env.DB_PORT;
const DB_DIALECT = process.env.DB_DIALECT;
const DB_HOST = process.env.DB_HOST;
const CA_CERT_PATH = path.resolve(__dirname, '../certificates/cert.pem');
const caCert = fs.readFileSync(CA_CERT_PATH, 'utf8');
//Initalize sequelize;
const sequelize = new Sequelize(`postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB}`, {
    dialect: DB_DIALECT,
    dialectModule: require('pg'),
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
    },
    // dialectOptions: {
    //     ssl: {
    //         require: true,
    //         rejectUnauthorized: false,
    //         ca: caCert
    //      },
    //     keepAlive: true,
    // },
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
