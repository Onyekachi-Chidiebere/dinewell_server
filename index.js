
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { dbConnection } = require('./utils/db-connection');

const router = require('./router');
const User = require('./models/user');
const Dish = require('./models/dish');
const Point = require('./models/points')
const Socket = require('./models/socket');

const port = process.env.PORT;

const app = express();

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
// add cors first before route
app.use(cors({ origin: '*' }));

// attach io to app so controllers can access it via req.app.get('io')
app.set('io', io);

io.on('connection', (socket) => {
    // client or merchant can join a restaurant room
    socket.on('joinRestaurant', (restaurantId) => {
        if (!restaurantId) return;
        socket.join(`restaurant:${restaurantId}`);
    });

    socket.on('disconnect', () => {
        // no-op for now
    });
});

app.use('/', router);
// connect to database;

dbConnection();

User.sync({ alter: true })
Dish.sync({ alter: true })
Point.sync({ alter: true })
Socket.sync({ alter: true })
// initalize server
httpServer.listen(port, () => {
    console.log(`Server started at http://localhost:${port}`);
});

