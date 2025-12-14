const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const config = require('config');

const User = require('../models/UserModel');
const VerificationToken = require('../models/VerificationToken');
const ResetToken = require('../models/ResetToken');

const { isValidObjectId } =require("mongoose");
const { sendError, createRandomBytes } = require('../utils/helper');
const { generateOTP, mailTransport, generateEmailTemplate, plainEmailTemplate, generatePasswordResetTemplate, newPasswordEmailTemplate } = require('../utils/mail');

const createUser = async (req, res) => {
    const { firstName, lastName, email, password } = req.body;
    try {
        const user = await User.findOne({ email });
    if (user) {
        return sendError(res, "This email already exists!");
    }
        const new_user = await User.create({
            firstName, lastName, email, password
        });
        const otp = generateOTP();
        const verificationToken = await VerificationToken.create({
            owner: new_user._id,
            token: otp
        })
        await verificationToken.save();
        await new_user.save();

        mailTransport().sendMail({
            from: 'do_not_reply@wavlang.com',
            to: new_user.email,
            subject: "Verify your email account",
            html: generateEmailTemplate(otp),
        });
        return res.status(200).json(new_user);
    } catch (error) {
        return res.status(400).json({
            message: error.message
        });
    }
};

const verifyEmail = async (req, res) => {
    const {userId, otp} = req.body;
    if(!userId || !otp.trim()) {
        return(
            sendError(res, 'Invalid request, missing parameters!')
        );
    };
    if(!isValidObjectId(userId)) {
        return(
            sendError(res, 'Invalid user id!')
        )
    };
    const user = await User.findById(userId);
    if(!user) {
        return(
            sendError(res, 'User is not found!')
        );
    };
    if(user.verified) {
        return(
            sendError(res, 'This email is already verified')
        );
    }
    
    const token = await VerificationToken.findOne({
        owner: user._id
    });

    if(!token) {
        if (!user.verified && new Date() - new Date(user.createdAt).getTime() > 600000) {
            await User.findByIdAndDelete(user._id);
            return(
                sendError(res, 'The verification period has expired and the user data has been deleted')
            )
        } else {
            return(
                sendError(res, 'Token not found or has already expired')
            );
        }
    }

    const isMatched = await token.compareToken(otp);
    if(!isMatched) {
        return(
            sendError(res, 'Please provide a valid token!')
        );
    }

    user.verified = true;
    await user.save();
    await VerificationToken.findByIdAndDelete(token._id);
}

const verifyJWT = (req, res, next) => {
    const token = req.headers['x-access-token'];
    const userEmail = req.headers['email'];

    if(!token || !userEmail) {
        return res.status(403).send({ auth: false, message: 'No token or email provided.' });
    }

    const userId = token;
    console.log('Decoded User ID:', userId);

    User.findById(userId).exec()
        .then(user => {
            if (!user) {
                return res.status(404).send({
                    auth: false,
                    message: 'No user found'
                })
            }
            if (user.email !== userEmail) {
                return res.status(403).send({
                    auth: false,
                    message: "Email does not match."
                })
            }
            req.user = user;
            next();
        })
        .catch(err => {
            console.error('Error finding user:', err);
            res.status(500).send({ message: 'Error finding user.' });
        });
};

const resendVerificationCode = async (req, res) => {
    const { userId } = req.body;
  
    if (!userId || !isValidObjectId(userId)) {
        return sendError(res, 'Invalid user ID provided.');
    }
  
    const user = await User.findById(userId);
    const currentToken = await VerificationToken.findOne({ owner: userId });
  
    if (currentToken && new Date() - currentToken.createdAt < 600000) {
        return sendError(res, 'You can only request a new code every 10 minutes. Please wait.');
    }
  
    if (!currentToken || new Date() - currentToken.createdAt >= 600000) {
            if (currentToken) {
            await VerificationToken.findByIdAndDelete(currentToken._id);
        }
        const newToken = generateOTP();
        const verificationToken = new VerificationToken({
            owner: userId,
            token: newToken,
        });
        await verificationToken.save();
  
        mailTransport().sendMail({
            from: 'do_not_reply@wavlang.com',
            to: user.email,
            subject: 'WavLang: Verify Your Email Account',
            html: generateEmailTemplate(newToken),
        });
  
        return res.json({
            success: true,
            message: 'A new verification code has been sent to your email.',
        });
    }
};

const signIn = async (req, res) => {
    const {email, password} = req.body;
    if(!email.trim() || !password.trim()){
        return sendError(res, "Email/Password is missing!");
    };

    const user = await User.findOne({email});
    if(!user) {
        return sendError(res, 'User not found!');
    };

    const isMatched = await user.comparePassword(password);
    if(!isMatched) {
        return sendError(res, 'Password does not match!');
    }

    const token = jwt.sign({userId: user._id}, process.env.JWT_SECRET, {
        expiresIn: '1d'
    });

    res.json({
        success: true,
        user: {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            verified: user.verified,
            // id: user._id,
            token: token
        }
    })
}

const forgotPassword = async (req, res) => {
    const {email} = req.body;
    if(!email) {
        return(
            sendError(res, 'Please provide a valid email')
        );
    }
    
    const user = await User.findOne({email});
    if(!user) {
        return(
            sendError(res, 'User is not found. Invalid request')
        );
    }

    // const token = await ResetToken.findOne({owner: user._id});
    const token = await ResetToken.findOne({ owner: user._id }).sort({ createdAt: -1 });
    if (token) {
        const timeSinceTokenCreated = Date.now() - token.createdAt.getTime();
        if (timeSinceTokenCreated < 600000) { // 600000 milliseconds = 10 minutes
            return sendError(res, 'You have already requested a new password. Only after 10 minutes, you can request for another password reset');
        }
        // If the token exists but is older than 10 minutes, remove it.
        await ResetToken.deleteOne({ _id: token._id });
    }
    const newToken = await createRandomBytes();
    const resetToken = new ResetToken({owner: user._id, token: newToken});
    await resetToken.save();

    mailTransport().sendMail({
        from: "do_not_reply@wavlang.com",
        to: user.email,
        subject: "WavLang: Reset Password",
        html: generatePasswordResetTemplate(`http://localhost:3000/reset-password?token=${newToken}&id=${user._id}`)
    });

    res.json({success: true, message: 'Reset Password link is sent to your inbox'});
}

const findUserWithJWT = async (req, res) => {
    try {
        const token = req.headers['x-access-token'];
        if (!token) {
            return sendError(res, "Token is missing in the request!");
        }

        const user = await User.findById(token);
        if (!user) {
            return sendError(res, 'User not found!');
        }

        res.json({
            success: true,
        });
    } catch (error) {
        console.error(error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: "An error occurred while looking for the user token" });
        }
    }
};

const resetPassword = async (req, res) => {
    try {
        const {password} = req.body;
        const user = await User.findById(req.user._id);
        if(!user) {
            return(sendError(res, 'User is not found'))
        }
        
        const isOldPassword = await user.comparePassword(password);
        if(isOldPassword) {
            return(sendError(res, 'New password must not match your old password'))
        }
        
        if(password.trim().length < 8 || password.trim().length > 20) {
            return(sendError(res, 'Password must be 8 to 20 characters long'))
        }
        
        user.password = password.trim();
        await user.save();
        await ResetToken.findOneAndDelete({owner: user._id});
    
        res.json({success: true, message: "Password Reset Successful"})
    } catch (error) {
        console.error(error);
        if(!res.headersSent) {
            res.status(500).json({success: false, message: "An error occurred during the password reset process"});
        }
    }
}

const googleSigninController = async(req, res) => {
    if (req.body.googleAccessToken) {
        // oauth
        axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
                "Authorization": `Bearer ${req.body.googleAccessToken}`
            }
        }).then( async response => {
            const email = response.data.email;

            const alreadyExistUser = await User.findOne({email});
            
            if (!alreadyExistUser) {
                return res.status(400).json({
                    message:"User doesn't exist!"
                })
            }

            const token = jwt.sign({
                email: alreadyExistUser.email,
                id: alreadyExistUser._id
            }, config.get("JWT_SECRET"), {expiresIn: '4h'})
            
            res.status(200).json({result: alreadyExistUser, token})
        })
    } else {
        // email, password
        const {email, password} = req.body;
        
        if(email === '' || password === '') {
            return res.status(400).json({
                message: "Invalid field!"
            })
        }

        try {
            const alreadyExistUser = await User.findOne({email});

            if (!alreadyExistUser) {
                return res.status(400).json({
                    message: "User doesn't exist!"
                })
            }

            const isPasswordCorrect = await bcrypt.compare(password, alreadyExistUser.password);

            if (!isPasswordCorrect) {
                return res.status(400).json({
                    message: "Invalid info!"
                })
            }

            const token = jwt.sign({
                email: alreadyExistUser.email,
                id: alreadyExistUser._id
            }, config.get("JWT_SECRET"), {expiresIn: '4h'})

            res.status(200).json({result: alreadyExistUser, token});
        }catch {
            console.log(err);
        }
    }
}

const googleSignupController = async(req, res) => {
    if (req.body.googleAccessToken) {
        // google oauth
        axios.getAdapter('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
                "Authorization": `Bearer ${req.body.googleAccessToken}`
            }
        }).then(async response => {
            const firstName = response.data.given_name;
            const lastName = response.data.family_name;
            const email = response.data.email;
            const picture = response.data.picture;
            
            const alreadyExistUser = await User.findOne({email});

            if (alreadyExistUser) {
                return res.status(400).json({
                    message: "User already exists!"
                })
            }
            
            const result = await User.create(firstName, lastName, email, profilePicture);
            const token = jwt.sign({
                email: result.email,
                id: result._id
            }, config.get('JWT_SECRET'), {expiresIn: '4h'})
            res.status(200).json({result, token})
        }).catch(err => {
            res.status(400).json({
                message: "Invalid info!"
            })
        })
    } else {
        // normal form data
        const {email, firstName, lastName, confirmPassword, password} = req.body;
        
        try {
            if(!email || !firstName || !lastName || !confirmPassword || !password || password.length < 8) {
                res.status(400).json({
                    message: 'Invalid field!'
                })
                const alreadyExistUser = await User.findOne({email});
                if(alreadyExistUser) {
                    return res.status(400).json({message: 'User already exist!'})
                }
                const hashPassword = await bcrypt.hash(password, 9);
                const result = await User.create({password: hashPassword, firstName, lastName, email, profilePicture:picture});

                const token = jwt.sign({
                    email: result.email,
                    id: result._id
                }, config.get("JWT_SECRET"), {expiresIn: '4h'})
                res.status(200).json({result, token})
            }
        } catch(err) {
            console.log(err)
        }
    }
}

module.exports = {
    googleSigninController,
    googleSignupController,
    createUser,
    signIn,
    verifyEmail,
    forgotPassword,
    resetPassword,
    resendVerificationCode,
    verifyJWT,
    findUserWithJWT
}