const mongoose = require('mongoose');

const billingSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true
    },
    userId: {
        typr: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    token: {
        type: Int16Array,
        required: true
    },
    fund: {
        type: Float32Array,
        required: true
    },
    planType: {
        type: String,
        required: true
    },
    updatedDate: {
        type: Date,
        required: true
    }
}, {timeStamps: true});

const userdb = new mongoose.model('Billing', billingSchema);

module.exports = userdb;