const { validateEnvironment } = require('./utils/env');
if (require.main === module) validateEnvironment();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { dbConnection } = require('./utils/db-connection');
const jwt = require('jsonwebtoken');
const runMigrations = require('./migrations/run');

const router = require('./router');
const User = require('./models/user');
const Dish = require('./models/dish');
const Points = require('./models/points'); // ✅ keep consistent plural name
const Payment = require('./models/payments');
const Socket = require('./models/socket');
const PlatformSettings = require('./models/platformSettings');
const Notification = require('./models/notification');
const DeviceToken = require('./models/deviceToken');
const RefreshToken = require('./models/refreshToken');
const OtpChallenge = require('./models/otpChallenge');
const cron = require('node-cron');
const paymentService = require('./services/paymentService');
const platformSettingsService = require('./services/platformSettingsService');

const port = process.env.PORT || 3000;

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const configuredOrigins = String(process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = isProduction
  ? configuredOrigins
  : [...configuredOrigins, 'http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000'];
const corsOrigin = (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error('Origin not allowed'));
};

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST']
  }
});

app.use(cors({ origin: corsOrigin }));

// attach io to app so controllers can access it via req.app.get('io')
app.set('io', io);

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const decoded = jwt.verify(token, process.env.JSON_WEB_SECRET, {
      issuer: 'dinewell',
      audience: 'dinewell-api',
    });
    const userId = Number(decoded.sub);
    if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error('Invalid subject');
    const user = await User.findByPk(userId);
    if (!user || user.approval_status === -1) throw new Error('Account unavailable');
    if (String(user.type).toLowerCase() === 'admin' && user.approval_status !== 1) {
      throw new Error('Admin unavailable');
    }
    socket.auth = { userId, role: String(user.type).toLowerCase() };
    next();
  } catch (_) {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', async (socket) => {
  try {
    const userId = socket.auth.userId;
    socket.join(`user:${userId}`);

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

// ✅ Initialize associations manually
const models = { User, Points, Dish, Payment, Socket, PlatformSettings, Notification, DeviceToken, RefreshToken, OtpChallenge };

Object.values(models).forEach((model) => {
  if (model.associate) {
    model.associate(models);
  }
});

async function start() {
  validateEnvironment();
  await dbConnection();
  await runMigrations();
  await platformSettingsService.ensureSettings();

  await new Promise((resolve) => httpServer.listen(port, resolve));
    console.log(`Server started at http://localhost:${port}`);

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
}

if (require.main === module) {
  start().catch((error) => {
    console.error('Startup failed:', error.message);
    process.exit(1);
  });
}

module.exports = { app, httpServer, start };
