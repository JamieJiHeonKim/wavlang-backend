const express = require('express');
const { makePayment, payment, createPaymentIntent } = require('../controllers/stripeController');

const router = express.Router();

// Route to handle payment using a payment intent
router.post('/pricing/payment', makePayment);

// Route to create a checkout session
router.post('/create-checkout-session', payment);

// Route to create a payment intent
router.post('/create-payment-intent', createPaymentIntent);

// Simple route for checking if the API is working
router.get('/', (req, res) => {
    console.log("GET Response from Stripe API");
    res.json({
        message: 'Stripe API works'
    });
});

module.exports = router;
