/**
 * this handles all the routes in the application;
 */
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const express = require('express');
const router = express.Router();
const merchantController = require('./controllers/merchantController');
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

module.exports = router;