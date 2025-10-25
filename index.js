const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { dbConnection } = require('./utils/db-connection');

const router = require('./router');
const User = require('./models/user');
const Dish = require('./models/dish');
const Points = require('./models/points'); // ✅ keep consistent plural name
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

app.use(cors({ origin: '*' }));

// attach io to app so controllers can access it via req.app.get('io')
app.set('io', io);

io.on('connection', async (socket) => {
  try {
    const { userId } = socket.handshake.query || {};

    if (userId) {
      try {
        const SocketModel = require('./models/socket');
        const existing = await SocketModel.findOne({ where: { user_id: userId } });
        if (existing) {
          await existing.update({ socket_id: socket.id });
        } else {
          await SocketModel.create({ user_id: userId, socket_id: socket.id });
        }
      } catch (err) {
        console.error('Failed to upsert socket record:', err);
      }
    }

    socket.on('disconnect', () => {
      // Optionally handle cleanup here
    });
  } catch (e) {
    console.error('Socket connection error:', e);
  }
});

app.use('/', router);

// connect to database
dbConnection();

// ✅ Initialize associations manually
const models = { User, Points, Dish, Socket };

Object.values(models).forEach((model) => {
  if (model.associate) {
    model.associate(models);
  }
});

// ✅ Sync tables AFTER associations are set
Promise.all([
  User.sync({ alter: true }),
  Dish.sync({ alter: true }),
  Points.sync({ alter: true }),
  Socket.sync({ alter: true })
]).then(() => {
  httpServer.listen(port, () => {
    console.log(`Server started at http://localhost:${port}`);
  });
});
