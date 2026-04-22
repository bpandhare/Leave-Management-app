const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
    faculty: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    week: {
        startDate: {
            type: Date,
            required: true
        },
        endDate: {
            type: Date,
            required: true
        }
    },
    timetableFile: {
        filename: {
            type: String,
            required: true
        },
        filepath: {
            type: String,
            required: true
        },
        originalname: {
            type: String
        },
        filesize: {
            type: Number
        },
        mimetype: {
            type: String
        }
    },
    description: {
        type: String,
        default: ''
    },
    classes: [
        {
            day: {
                type: String,
                enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                required: true
            },
            time: String,
            courseCode: String,
            courseName: String,
            classroom: String
        }
    ],
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    department: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Index for quick lookups
timetableSchema.index({ faculty: 1, week: 1 });
timetableSchema.index({ faculty: 1, createdAt: -1 });

module.exports = mongoose.model('Timetable', timetableSchema);
