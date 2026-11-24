/**
 * this handles all the routes in the application;
 */
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const express = require('express');
const router = express.Router();
const merchantController = require('./controllers/merchantController');
const dishController = require('./controllers/dishController');
const cardController = require('./controllers/cardController');
const clientController = require('./controllers/clientController');
const pointsController = require('./controllers/pointsController');
const paymentController = require('./controllers/paymentController');
const adminController = require('./controllers/adminController');
const adminStatisticsController = require('./controllers/adminStatisticsController');
const platformSettingsController = require('./controllers/platformSettingsController');
const notificationController = require('./controllers/notificationController');
const adminAuth = require('./utils/adminAuth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const authController = require('./controllers/authController');
const stripeWebhookController = require('./controllers/stripeWebhookController');
const { authenticate, authorizeRoles, resolveSelfParam, requireOwnership, requirePointOwnership, requireDishOwnership } = require('./middleware/auth');
const { requireSignupToken } = require('./middleware/signupAuth');
const rateLimit = require('./middleware/rateLimit');

const authLimit = rateLimit({ keyPrefix: 'auth', windowMs: 15 * 60 * 1000, max: 20 });
const otpLimit = rateLimit({ keyPrefix: 'otp', windowMs: 15 * 60 * 1000, max: 5 });
const uploadLimit = rateLimit({ keyPrefix: 'upload', windowMs: 15 * 60 * 1000, max: 20 });
const pointsLimit = rateLimit({ keyPrefix: 'points', windowMs: 60 * 1000, max: 60 });
const paymentLimit = rateLimit({ keyPrefix: 'payment', windowMs: 60 * 1000, max: 20 });

router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookController.handle);

router.use(bodyParser.json({ limit: '50mb' })); 
router.use(bodyParser.urlencoded({ limit: '50mb', extended: true })); 
router.use(cookieParser());

// Merchant sign-up steps
router.get('/health', (req, res) => res.json({ status: 'ok' }));
router.get('/ready', async (req, res) => {
  try {
    await require('./utils/db-connection').sequelize.authenticate();
    res.json({ status: 'ready' });
  } catch (_) {
    res.status(503).json({ status: 'not_ready' });
  }
});
router.post('/auth/refresh', authLimit, authController.refresh);
router.post('/auth/logout', authLimit, authController.logout);

router.post('/merchant/signup/details', authLimit, merchantController.signupDetails);
router.post('/merchant/signup/address', authLimit, requireSignupToken, merchantController.signupAddress);
router.post(
  '/merchant/signup/pictures',
  uploadLimit,
  requireSignupToken,
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'restaurantImages', maxCount: 5 },
  ]),
  merchantController.signupPictures
);
router.post('/merchant/signup/pictures-base64', uploadLimit, requireSignupToken, merchantController.signupPicturesBase64);
router.post('/merchant/signup/complete', authLimit, requireSignupToken, merchantController.completeSignup);
router.get('/merchant/signup/progress', authLimit, requireSignupToken, merchantController.getSignupProgress);
router.post('/merchant/signup/card', (req, res) => res.status(410).json({ error: 'Legacy card signup is disabled; use /cards/add with a Stripe PaymentMethod ID' }));
router.post('/merchant/login', authLimit, merchantController.login);
router.post('/merchant/forgot-password/send-otp', otpLimit, authController.sendResetOtp('Merchant'));
router.post('/merchant/forgot-password/verify-otp', otpLimit, authController.verifyResetOtp('Merchant'));
router.post('/merchant/forgot-password/reset', otpLimit, authController.resetPassword('Merchant'));
router.get('/merchant/:merchantId/statistics', authenticate, authorizeRoles('merchant', 'admin'), resolveSelfParam('merchantId'), requireOwnership(['params', 'merchantId']), merchantController.getStatistics);
router.get('/merchant/:merchantId/approval-status', authenticate, authorizeRoles('merchant', 'admin'), resolveSelfParam('merchantId'), requireOwnership(['params', 'merchantId']), merchantController.getApprovalStatus);
router.get('/merchant/restaurants', merchantController.getRestaurants);
router.get('/merchant/restaurants/:restaurantId', merchantController.getRestaurantDetails);
router.put('/merchant/profile/:userId', authenticate, authorizeRoles('merchant'), resolveSelfParam('userId'), requireOwnership(['params', 'userId']), uploadLimit, upload.single('profileImage'), merchantController.updateMerchantProfile);
router.put('/merchant/:merchantId/password', authenticate, authorizeRoles('merchant'), resolveSelfParam('merchantId'), requireOwnership(['params', 'merchantId']), authLimit, merchantController.changePassword);

// Dish management routes
router.post('/dishes', authenticate, authorizeRoles('merchant'), uploadLimit, upload.single('dishImage'), (req, _res, next) => { req.body.restaurantId = req.auth.userId; next(); }, dishController.createDish);
router.post('/dishes/base64', authenticate, authorizeRoles('merchant'), uploadLimit, (req, _res, next) => { req.body.restaurantId = req.auth.userId; next(); }, dishController.createDishBase64);
router.get('/dishes/:id', dishController.getDish);
router.get(['/restaurants/me/dishes','/restaurants/me/dishes/:searchQuery'], authenticate, authorizeRoles('merchant'), (req, _res, next) => { req.params.restaurantId = String(req.auth.userId); next(); }, dishController.getRestaurantDishes);
router.get(['/restaurants/:restaurantId/dishes','/restaurants/:restaurantId/dishes/:searchQuery'], dishController.getRestaurantDishes);
router.put('/dishes/:id', authenticate, authorizeRoles('merchant'), requireDishOwnership, uploadLimit, upload.single('dishImage'), dishController.updateDish);
router.put('/dishes/:id/base64', authenticate, authorizeRoles('merchant'), requireDishOwnership, uploadLimit, dishController.updateDishBase64);
router.patch('/dishes/:id/status', authenticate, authorizeRoles('merchant'), requireDishOwnership, dishController.setDishStatus);
router.delete('/dishes/:id', authenticate, authorizeRoles('merchant'), requireDishOwnership, dishController.deleteDish);

// Card management routes (Stripe)
router.post('/cards/add', authenticate, authorizeRoles('merchant'), paymentLimit, cardController.addCard);
router.post('/cards/default', authenticate, authorizeRoles('merchant'), paymentLimit, cardController.setDefault);
router.post('/cards/charge', cardController.charge);
router.get('/cards', authenticate, authorizeRoles('merchant'), paymentLimit, cardController.list);

// Client management routes
router.post('/client/signup', authLimit, clientController.createClient);
router.post('/client/signin', authLimit, clientController.signInClient);
router.post('/client/forgot-password/send-otp', otpLimit, authController.sendResetOtp('Customer'));
router.post('/client/forgot-password/verify-otp', otpLimit, authController.verifyResetOtp('Customer'));
router.post('/client/forgot-password/reset', otpLimit, authController.resetPassword('Customer'));
router.put('/client/:customerId/password', authenticate, authorizeRoles('customer'), requireOwnership(['params', 'customerId']), authLimit, clientController.changePassword);
router.get('/client/profile/:userId', authenticate, authorizeRoles('customer', 'admin'), requireOwnership(['params', 'userId']), clientController.getClientProfile);
router.put('/client/profile/:userId', authenticate, authorizeRoles('customer'), requireOwnership(['params', 'userId']), uploadLimit, upload.single('profileImage'), clientController.updateClientProfile);
router.get('/client/username/check', authLimit, clientController.checkUsernameAvailability);
router.post('/client/username/suggest', authLimit, clientController.generateUsernameSuggestion);
router.get('/client/:clientId/statistics', authenticate, authorizeRoles('customer', 'admin'), requireOwnership(['params', 'clientId']), clientController.getStatistics);
router.get('/client/:clientId/points-earned', authenticate, authorizeRoles('customer', 'admin'), requireOwnership(['params', 'clientId']), clientController.getPointsEarnedData);
router.get('/client/:clientId/restaurants-visited', authenticate, authorizeRoles('customer', 'admin'), requireOwnership(['params', 'clientId']), clientController.getRestaurantsVisitedData);
router.get('/client/:clientId/transaction-history', authenticate, authorizeRoles('customer', 'admin'), requireOwnership(['params', 'clientId']), clientController.getTransactionHistory);
router.get('/client/:clientId/visited-restaurants', authenticate, authorizeRoles('customer', 'admin'), requireOwnership(['params', 'clientId']), clientController.getVisitedRestaurants);
router.get('/client/restaurants', clientController.getAllRestaurants);
router.get('/client/customers', adminAuth, clientController.getCustomers);
router.get('/client/customers/:customerId', adminAuth, clientController.getCustomerDetails);
router.post('/client/:senderId/share-points', authenticate, authorizeRoles('customer'), requireOwnership(['params', 'senderId']), pointsLimit, clientController.sharePoints);
// Points management routes
router.post('/points', authenticate, authorizeRoles('merchant'), pointsLimit, (req, _res, next) => { req.body.restaurantId = req.auth.userId; next(); }, pointsController.createPoints);
router.get('/points/:id', authenticate, requirePointOwnership, pointsController.getPointsById);
router.put('/points/:id', authenticate, requirePointOwnership, pointsLimit, pointsController.updatePoints);
router.get('/restaurants/:restaurantId/points', authenticate, authorizeRoles('merchant', 'admin'), requireOwnership(['params', 'restaurantId']), pointsController.getPointsByRestaurant);
router.get('/points/qr/:qrCode', authenticate, authorizeRoles('customer'), pointsController.getPointsByQrCode);
router.post('/points/:id/issue', authenticate, authorizeRoles('merchant'), requirePointOwnership, pointsLimit, pointsController.issuePoints);
router.post('/points/scan/:qrCode', authenticate, authorizeRoles('customer'), pointsLimit, (req, _res, next) => { req.body.customerId = req.auth.userId; next(); }, pointsController.scanQrCode);
router.get('/points/admin/list', adminAuth, pointsController.getPointsForAdmin);
router.get('/rate', pointsController.getPointsRate);
router.get('/restaurants/:restaurantId/points/history', authenticate, authorizeRoles('merchant', 'admin'), resolveSelfParam('restaurantId'), requireOwnership(['params', 'restaurantId']), pointsController.getPointsHistoryForMerchant);

// Notification preferences + inbox
router.get('/users/:userId/notification-preferences', authenticate, resolveSelfParam('userId'), requireOwnership(['params', 'userId']), notificationController.getPreferences);
router.put('/users/:userId/notification-preferences', authenticate, resolveSelfParam('userId'), requireOwnership(['params', 'userId']), notificationController.updatePreferences);
router.get('/users/:userId/notifications', authenticate, resolveSelfParam('userId'), requireOwnership(['params', 'userId']), notificationController.listNotifications);
router.get('/users/:userId/notifications/unread-count', authenticate, resolveSelfParam('userId'), requireOwnership(['params', 'userId']), notificationController.getUnreadCount);
router.patch('/users/:userId/notifications/read-all', authenticate, resolveSelfParam('userId'), requireOwnership(['params', 'userId']), notificationController.markAllAsRead);
router.patch('/users/:userId/notifications/:notificationId/read', authenticate, resolveSelfParam('userId'), requireOwnership(['params', 'userId']), notificationController.markAsRead);
router.post('/users/:userId/device-tokens', authenticate, resolveSelfParam('userId'), requireOwnership(['params', 'userId']), notificationController.registerDeviceToken);
router.delete('/users/:userId/device-tokens', authenticate, resolveSelfParam('userId'), requireOwnership(['params', 'userId']), notificationController.removeDeviceToken);
router.delete('/users/me', authenticate, authLimit, authController.deleteMe);

// Payment management routes
router.get('/restaurants/:restaurantId/payments/history', authenticate, authorizeRoles('merchant', 'admin'), resolveSelfParam('restaurantId'), requireOwnership(['params', 'restaurantId']), paymentLimit, paymentController.getPaymentHistory);
router.post('/payments/process-daily', adminAuth, platformSettingsController.processDailyPayments); // Admin endpoint

// Admin management routes
router.post('/admin/login', adminController.adminLogin);
if (process.env.NODE_ENV !== 'production') {
  router.post('/admin/create', authLimit, adminAuth, adminController.createAdmin);
}
router.get('/admin/profile', adminAuth, adminController.getAdminProfile);
router.put('/admin/password', adminAuth, adminController.updateAdminPassword);
router.get('/admin/restaurants', adminAuth, adminController.getRestaurants);
router.patch('/admin/restaurants/:restaurantId/approve', adminAuth, adminController.approveRestaurant);
router.patch('/admin/restaurants/:restaurantId/disable', adminAuth, adminController.disableRestaurant);
router.get('/admin/settings/platform', adminAuth, platformSettingsController.getPlatformSettings);
router.put('/admin/settings/platform', adminAuth, platformSettingsController.updatePlatformSettings);
router.get('/admin/payments', adminAuth, platformSettingsController.getPayments);

// Admin statistics routes
router.get('/admin/statistics/restaurants', adminAuth, adminStatisticsController.getRestaurantStatistics);
router.get('/admin/statistics/customers', adminAuth, adminStatisticsController.getCustomerStatistics);
router.get('/admin/statistics/user-activity', adminAuth, adminStatisticsController.getUserActivityData);
router.get('/admin/statistics/restaurant-leaderboard', adminAuth, adminStatisticsController.getRestaurantLeaderboard);
router.get('/admin/statistics/customer-leaderboard', adminAuth, adminStatisticsController.getCustomerLeaderboard);
router.get('/admin/statistics/points-graph', adminAuth, adminStatisticsController.getPointsGraphData);
router.get('/admin/statistics/dashboard-overview', adminAuth, adminStatisticsController.getDashboardOverview);

module.exports = router;