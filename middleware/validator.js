const { check, validationResult } = require('express-validator');

const validateUser = [
    check('firstName')
        .trim()
        .not()
        .isEmpty()
        .withMessage('First name is missing')
        .isLength({min: 2, max: 20})
        .withMessage('Invalid first name, first name must be 2 to 20 characters long'),
    check('email')
        .normalizeEmail()
        .isEmail()
        .withMessage('Email is invalid'),
    check('password')
        .trim()
        .not()
        .isEmpty()
        .withMessage('Password is missing')
        .isLength({min: 8, max: 20})
        .withMessage('Password must be 8 to 20 characters long'),
];

const validate = (req, res, next) => {
    const error = validationResult(req).array();
    if(!error.length) {
        return next();
    }
    res.status(400).json({success: false, error: error[0].msg})
};

module.exports = {
    validateUser,
    validate
}