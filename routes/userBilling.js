const express = require('express');
const router = express.Router()

const { userBillingController } = require('../controllers/billingController');

router.post('/user/:id/billing', userBillingController);

module.exports = router;