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
const adminController = require('./controllers/adminController');
const adminStatisticsController = require('./controllers/adminStatisticsController');
const adminAuth = require('./utils/adminAuth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.use(bodyParser.json({ limit: '50mb' })); 
router.use(bodyParser.urlencoded({ limit: '50mb', extended: true })); 
router.use(cookieParser());

// Merchant sign-up steps
router.post('/merchant/signup/details', merchantController.signupDetails);
router.post('/merchant/signup/address', merchantController.signupAddress);
router.post(
  '/merchant/signup/pictures',
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'restaurantImages', maxCount: 5 },
  ]),
  merchantController.signupPictures
);
router.post('/merchant/signup/card', merchantController.signupCard);
router.post('/merchant/login', merchantController.login);
router.get('/merchant/:merchantId/statistics', merchantController.getStatistics);
router.get('/merchant/restaurants', merchantController.getRestaurants);
router.get('/merchant/restaurants/:restaurantId', merchantController.getRestaurantDetails);

// Dish management routes
router.post('/dishes', upload.single('dishImage'), dishController.createDish);
router.get('/dishes/:id', dishController.getDish);
router.get('/restaurants/:restaurantId/dishes', dishController.getRestaurantDishes);
router.put('/dishes/:id', upload.single('dishImage'), dishController.updateDish);
router.delete('/dishes/:id', dishController.deleteDish);

// Card management routes (Stripe)
router.post('/cards/add', cardController.addCard);
router.post('/cards/default', cardController.setDefault);
router.post('/cards/charge', cardController.charge);
router.get('/cards', cardController.list);

// Client management routes
router.post('/client/signup', clientController.createClient);
router.post('/client/signin', clientController.signInClient);
router.get('/client/profile/:userId', clientController.getClientProfile);
router.put('/client/profile/:userId', upload.single('profileImage'), clientController.updateClientProfile);
router.get('/client/username/check', clientController.checkUsernameAvailability);
router.post('/client/username/suggest', clientController.generateUsernameSuggestion);
router.get('/client/:clientId/statistics', clientController.getStatistics);
router.get('/client/customers', clientController.getCustomers);
router.get('/client/customers/:customerId', clientController.getCustomerDetails);
router.post('/client/:senderId/share-points', clientController.sharePoints);
// Points management routes
router.post('/points', pointsController.createPoints);
router.get('/points/:id', pointsController.getPointsById);
router.put('/points/:id', pointsController.updatePoints);
router.get('/restaurants/:restaurantId/points', pointsController.getPointsByRestaurant);
router.get('/points/qr/:qrCode', pointsController.getPointsByQrCode);
router.post('/points/:id/issue', pointsController.issuePoints);
router.post('/points/scan/:qrCode', pointsController.scanQrCode);
router.get('/points/admin/list', pointsController.getPointsForAdmin);

// Admin management routes
router.post('/admin/login', adminController.adminLogin);
router.post('/admin/create', adminController.createAdmin);
router.get('/admin/profile', adminAuth, adminController.getAdminProfile);
router.put('/admin/password', adminAuth, adminController.updateAdminPassword);

// Admin statistics routes
router.get('/admin/statistics/restaurants', adminAuth, adminStatisticsController.getRestaurantStatistics);
router.get('/admin/statistics/customers', adminAuth, adminStatisticsController.getCustomerStatistics);
router.get('/admin/statistics/user-activity', adminAuth, adminStatisticsController.getUserActivityData);
router.get('/admin/statistics/restaurant-leaderboard', adminAuth, adminStatisticsController.getRestaurantLeaderboard);
router.get('/admin/statistics/customer-leaderboard', adminAuth, adminStatisticsController.getCustomerLeaderboard);
router.get('/admin/statistics/points-graph', adminAuth, adminStatisticsController.getPointsGraphData);
router.get('/admin/statistics/dashboard-overview', adminAuth, adminStatisticsController.getDashboardOverview);

module.exports = router;