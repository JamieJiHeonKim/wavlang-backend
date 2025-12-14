const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    verified: {
        type: Boolean,
        default: false,
        required: true
    }
    // },
    // profilePicture: {
    //     type: String,
    //     required: false
    // }
}, { timestamps: true });

userSchema.pre('save', async function(next){
    if(this.isModified('password')) {
        const hash = await bcrypt.hash(this.password, 8);
        this.password = hash;
    }
    next();
})

userSchema.methods.comparePassword = async function(password) {
    const result = await bcrypt.compare(password, this.password);
    return result;
}

const userdb = new mongoose.model('User', userSchema);

module.exports = userdb;