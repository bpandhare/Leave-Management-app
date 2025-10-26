const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
    faculty: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Faculty reference is required']
    },
    leaveType: {
        type: String,
        enum: ['Sick', 'Casual', 'Emergency', 'Personal', 'Other'],
        required: [true, 'Leave type is required']
    },
    startDate: {
        type: Date,
        required: [true, 'Start date is required'],
        validate: {
            validator: function(value) {
                return value >= new Date().setHours(0,0,0,0);
            },
            message: 'Start date cannot be in the past'
        }
    },
    endDate: {
        type: Date,
        required: [true, 'End date is required'],
        validate: {
            validator: function(value) {
                return value >= this.startDate;
            },
            message: 'End date must be after start date'
        }
    },
    totalDays: {
        type: Number,
        min: [1, 'Leave must be at least 1 day']
    },
    reason: {
        type: String,
        required: [true, 'Reason is required'],
        maxlength: [500, 'Reason cannot exceed 500 characters']
    },
    workloadAssignments: [{
        faculty: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        subject: {
            type: String,
            required: true
        },
        date: {
            type: Date,
            required: true
        },
        timeSlot: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ['Pending', 'Accepted', 'Rejected'],
            default: 'Pending'
        }
    }],
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    comments: {
        type: String,
        maxlength: [200, 'Comments cannot exceed 200 characters']
    }
}, {
    timestamps: true
});

// Calculate total days before saving
leaveSchema.pre('save', function(next) {
    if (this.startDate && this.endDate) {
        const timeDiff = this.endDate.getTime() - this.startDate.getTime();
        this.totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    }
    next();
});

// Index for better query performance
leaveSchema.index({ faculty: 1, createdAt: -1 });
leaveSchema.index({ status: 1 });
leaveSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('Leave', leaveSchema);