const express = require('express');
const router = express.Router()
const { validateUser, validate } = require('../middleware/validator');
const { isResetTokenValid, isEmailVerificationTokenValid } = require('../middleware/user');

const { googleSigninController, googleSignupController, createUser, signIn, verifyEmail, forgotPassword, resetPassword, resendVerificationCode, verifyJWT, findUserWithJWT } = require('../controllers/userController');

router.post('/google-signin', googleSigninController);
router.post('/google-signup', googleSignupController);
router.post('/new_user', validateUser, validate, createUser);
router.post('/signin', signIn);
router.post('/forgot-password', forgotPassword);
router.post('/resend-verification-code', resendVerificationCode);
router.post('/verify-email', isEmailVerificationTokenValid, verifyEmail);
router.post('/user/reset-password', isResetTokenValid, resetPassword);
router.get('/user/verify-token', isResetTokenValid, (req, res) => {
    res.json({success: true})
});
router.get('/user/verify-email', isEmailVerificationTokenValid, (req, res) => {
    res.json({success: true})
});
router.get('/user/authenticated', verifyJWT, (req, res) => {
    const user = req.user;
    res.json({
        success: true,
        data: {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            verified: user.verified
        }
    })
});

router.get('/user/:userId', findUserWithJWT, (req, res) => {
    const userId = req.params.userId;
    res.json({success: true})
});

module.exports = router;