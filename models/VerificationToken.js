const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const VerificationTokenSchema = new mongoose.Schema({
    owner : {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    token: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        expires: 600,
        default: Date.now()
    }
});

VerificationTokenSchema.pre('save', async function(next){
    if(this.isModified('token')) {
        const hash = await bcrypt.hash(this.token, 8);
        this.token = hash;
    }
    next();
})

VerificationTokenSchema.methods.compareToken = async function(token) {
    const result = await bcrypt.compare(token, this.token);
    return result;
}

const verificationTokendb = new mongoose.model('VerificationToken', VerificationTokenSchema);

module.exports = verificationTokendb;