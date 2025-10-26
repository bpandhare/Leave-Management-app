// models/WorkloadAssignment.js
const mongoose = require('mongoose');

const workloadAssignmentSchema = new mongoose.Schema({
    leaveApplication: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'LeaveApplication', 
        required: true 
    },
    assignedTo: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    assignedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    subjects: [{ type: String }],
    classes: [{ type: String }],
    totalHours: { type: Number, required: true },
    status: { 
        type: String, 
        enum: ['pending', 'approved', 'rejected'], 
        default: 'pending' 
    },
    rejectionReason: { type: String },
    assignedAt: { type: Date, default: Date.now },
    respondedAt: { type: Date }
});

module.exports = mongoose.model('WorkloadAssignment', workloadAssignmentSchema);