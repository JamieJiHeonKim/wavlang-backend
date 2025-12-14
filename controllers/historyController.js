const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const config = require('config');

const User = require('../models/UserModel');

const userHistoryController = async(req, res) => {
    if (req.body.googleAccessToken) {

    }
}