const { isValidObjectId } = require("mongoose");
const { sendError } = require("../utils/helper");
const User = require('../models/UserModel');
const ResetToken = require('../models/ResetToken');
const EmailVerificationToken = require('../models/VerificationToken');

const isResetTokenValid = async (req, res, next) => {
    const {token, id} = req.query;
    if(!token || !id) {
        return(sendError(res, 'Invalid request'))
    }
    if(!isValidObjectId(id)) {
        return(sendError(res, 'Invalid user'))
    }

    const user = await User.findById(id);
    if(!user) {
        return(sendError(res, 'User is not found'))
    }
    
    const resetToken = await ResetToken.findOne({owner: user._id});
    if(!resetToken) {
        return(sendError(res, 'Reset Token is either not found or has already expired'))
    };

    const isValid = await resetToken.compareToken(token);
    if(!isValid) {
        return(sendError(res, 'Reset Token is not valid'))
    }
    req.user = user;
    next();
}

const isEmailVerificationTokenValid = async (req, res, next) => {
    const {id} = req.query;

    if(!isValidObjectId(id)) {
        return(sendError(res, 'Invalid user'))
    }

    const user = await User.findById(id);
    if(!user) {
        return(sendError(res, 'User is not found'))
    }

    const emailVerificationToken = await EmailVerificationToken.findOne({owner: user._id});
    if(!emailVerificationToken) {
        return(sendError(res, 'Email Verification Token is either not found or has already expired'))
    };

    // const isValid = await emailVerificationToken.compareToken(token);
    // if(!isValid) {
    //     return(sendError(res, 'Email Verification Token is not valid'))
    // }
    req.user = user;
    next();
}

module.exports = {
    isResetTokenValid,
    isEmailVerificationTokenValid
}