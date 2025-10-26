// models/LeaveApplication.js
const mongoose = require('mongoose');

const leaveApplicationSchema = new mongoose.Schema({
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    leaveType: { type: String, enum: ['sick', 'casual', 'vacation', 'emergency'], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    hod: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LeaveApplication', leaveApplicationSchema);