
const express = require('express');
const http = require('http');
const cors = require('cors');
const { dbConnection } = require('./utils/db-connection');

const router = require('./router');
const User = require('./models/user');
const Dish = require('./models/dish');
const Point = require('./models/points')

const port = process.env.PORT;

const app = express();

const httpServer = http.createServer(app);
// add cors first before route
app.use(cors({ origin: '*' }));

app.use('/', router);
// connect to database;

dbConnection();

User.sync({ alter: true })
Dish.sync({ alter: true })
Point.sync({ alter: true })

// initalize server
httpServer.listen(port, () => {
    console.log(`Server started at http://localhost:${port}`);
});

