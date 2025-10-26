const mongoose = require('mongoose');
// models/User.js
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['faculty', 'hod', 'admin'], required: true },
    department: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

// models/LeaveApplication.js
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

// models/WorkloadAssignment.js
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