

const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const fs = require('fs'); // <--- need this to read certificate file
const path = require('path')

//this initalizes the environment variables;
dotenv.config({ quiet: true });

const DB = process.env.DB;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_PORT = process.env.DB_PORT;
const DB_DIALECT = process.env.DB_DIALECT || 'postgres';
const DB_HOST = process.env.DB_HOST;
const DATABASE_URL = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === 'production';
const configuredCaPath = process.env.DB_CA_CERT_PATH;
const defaultCaPath = path.resolve(__dirname, '../certificates/cert.pem');
const caPath = configuredCaPath || (fs.existsSync(defaultCaPath) ? defaultCaPath : null);
const caCert = caPath ? fs.readFileSync(caPath, 'utf8') : undefined;
if (isProduction && process.env.DB_SSL !== 'false' && !caCert && process.env.DB_SSL_ALLOW_SYSTEM_CA !== 'true') {
    throw new Error('Production database TLS requires DB_CA_CERT_PATH or DB_SSL_ALLOW_SYSTEM_CA=true');
}
//Initalize sequelize;
const connectionOptions = {
    dialect: DB_DIALECT,
    dialectModule: require('pg'),
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
    },
    dialectOptions: {
        ssl: process.env.DB_SSL === 'false' ? false : {
            require: true,
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
            ...(caCert ? { ca: caCert } : {}),
         },
        keepAlive: true,
    },
};
const sequelize = DATABASE_URL
    ? new Sequelize(DATABASE_URL, connectionOptions)
    : new Sequelize(DB, DB_USER, DB_PASSWORD, {
        ...connectionOptions,
        host: DB_HOST,
        port: DB_PORT,
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
        console.error('Unable to connect to the database:', error.message);
        throw error;
    }

};

//export the connections;
module.exports = {
    dbConnection,
    sequelize,
}
