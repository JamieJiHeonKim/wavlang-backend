const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
    id: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    recentlyTranscribed: {
        type: String,
        required: false
    },
    updatedDate: {
        type: Date,
        required: true
    }
}, {timeStamps: true});

const userdb = new mongoose.model('History', historySchema);

module.exports = userdb;