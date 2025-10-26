const mongoose = require('mongoose');

const workloadSchema = new mongoose.Schema({
    originalFaculty: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Original faculty reference is required']
    },
    assignedFaculty: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Assigned faculty reference is required']
    },
    subject: {
        type: String,
        required: [true, 'Subject name is required'],
        trim: true
    },
    slot: {
        type: String,
        required: [true, 'Time slot is required'],
        trim: true
    },
    date: {
        type: Date,
        required: [true, 'Date is required']
    },
    status: {
        type: String,
        enum: ['Pending', 'Accepted', 'Rejected'],
        default: 'Pending'
    },
    leaveReference: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Leave',
        required: true
    }
}, {
    timestamps: true
});

// Index for better query performance
workloadSchema.index({ assignedFaculty: 1, status: 1 });
workloadSchema.index({ originalFaculty: 1 });
workloadSchema.index({ date: 1 });

module.exports = mongoose.model('Workload', workloadSchema);