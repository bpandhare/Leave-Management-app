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
                // Only validate on creation or when startDate is modified
                if (!this.isNew && !this.isModified('startDate')) return true;
                const today = new Date();
                today.setHours(0,0,0,0);
                return value >= today;
            },
            message: 'Start date cannot be in the past'
        }
    },
    endDate: {
        type: Date,
        required: [true, 'End date is required'],
        validate: {
            validator: function(value) {
                // Only validate when endDate or startDate is modified (or on create)
                if (!this.isNew && !this.isModified('endDate') && !this.isModified('startDate')) return true;
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
        details: {
            type: String,
            maxlength: [300, 'Details cannot exceed 300 characters']
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
    },
    rejectionReason: {
        type: String,
        maxlength: [500, 'Rejection reason cannot exceed 500 characters']
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