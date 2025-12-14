const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const ResetTokenSchema = new mongoose.Schema({
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

ResetTokenSchema.pre('save', async function(next){
    if(this.isModified('token')) {
        const hash = await bcrypt.hash(this.token, 8);
        this.token = hash;
    }
    next();
})

ResetTokenSchema.methods.compareToken = async function(token) {
    const result = await bcrypt.compare(token, this.token);
    return result;
}

const resetTokendb = new mongoose.model('ResetToken', ResetTokenSchema);

module.exports = resetTokendb;