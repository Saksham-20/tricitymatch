const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment, getMySubscription, getPlans, webhook } = require('../controllers/subscriptionController');
const { auth } = require('../middlewares/auth');

router.post('/create-order', auth, createOrder);
router.post('/verify-payment', auth, verifyPayment);
router.get('/my-subscription', auth, getMySubscription);
router.get('/plans', getPlans);
router.post('/webhook', webhook); // Should add webhook secret verification in production

module.exports = router;

