const express = require('express');
const router = express.Router()

const { userHistoryController } = require('../controllers/historyController');

router.post('/user/:id/history', userHistoryController);

module.exports = router;