const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { dbConnection } = require('./utils/db-connection');

const router = require('./router');
const User = require('./models/user');
const Dish = require('./models/dish');
const Points = require('./models/points'); // ✅ keep consistent plural name
const Payment = require('./models/payments');
const Socket = require('./models/socket');
const PlatformSettings = require('./models/platformSettings');
const Notification = require('./models/notification');
const DeviceToken = require('./models/deviceToken');
const cron = require('node-cron');
const paymentService = require('./services/paymentService');
const platformSettingsService = require('./services/platformSettingsService');

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
const models = { User, Points, Dish, Payment, Socket, PlatformSettings, Notification, DeviceToken };

Object.values(models).forEach((model) => {
  if (model.associate) {
    model.associate(models);
  }
});

// ✅ Sync tables AFTER associations are set
// Sync Payment before Points since Points has a foreign key to Payment
Promise.all([
  User.sync({ alter: true }),
  Dish.sync({ alter: true }),
  Payment.sync({ alter: true }),
  Socket.sync({ alter: true }),
  PlatformSettings.sync({ alter: true }),
  Notification.sync({ alter: true }),
  DeviceToken.sync({ alter: true }),
]).then(() => {
  // Sync Points after Payment is created
  return Points.sync({ alter: true });
}).then(async () => {
  await platformSettingsService.ensureSettings();

  httpServer.listen(port, () => {
    console.log(`Server started at http://localhost:${port}`);
  });

  // Set up daily cron job to process payments at 2 AM every day
  // Cron format: minute hour day month day-of-week
  cron.schedule('0 2 * * *', async () => {
    console.log('Running scheduled daily payment processing...');
    try {
      await paymentService.processDailyPayments();
    } catch (error) {
      console.error('Error in scheduled payment processing:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/New_York" // Adjust timezone as needed
  });

  console.log('Daily payment processing job scheduled (runs at 2 AM daily)');
});
