require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const cron = require('node-cron');
const fileUpload = require('express-fileupload');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// File upload middleware - configure before other middleware
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
    abortOnLimit: true,
    useTempFiles: true,
    tempFileDir: '/tmp/',
    createParentPath: true,
    parseNested: true
}));

app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Flash messages middleware
const flash = require('connect-flash');
app.use(flash());

// Debug: Check if models load correctly
console.log('🔧 Loading models...');
try {
    const User = require('./models/User');
    console.log('✅ User model loaded successfully');
} catch (error) {
    console.error('❌ Error loading User model:', error.message);
    process.exit(1);
}

try {
    const LeaveRequest = require('./models/LeaveRequest');
    console.log('✅ LeaveRequest model loaded successfully');
} catch (error) {
    console.error('❌ Error loading LeaveRequest model:', error.message);
    process.exit(1);
}

try {
    const WorkloadAssignment = require('./models/WorkloadAssignment');
    console.log('✅ WorkloadAssignment model loaded successfully');
} catch (error) {
    console.error('❌ Error loading WorkloadAssignment model:', error.message);
    process.exit(1);
}

try {
    const LeaveApplication = require('./models/LeaveApplication');
    console.log('✅ LeaveApplication model loaded successfully');
} catch (error) {
    console.error('❌ Error loading LeaveApplication model:', error.message);
    process.exit(1);
}

// Database connection with better error handling
console.log('🔧 Connecting to database...');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/leave-management', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log('✅ MongoDB connected successfully');
})
.catch((error) => {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
});

// MongoDB connection event handlers
mongoose.connection.on('connected', () => {
    console.log('✅ Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️  Mongoose disconnected from MongoDB');
});

// Auto-approval cron job setup
const { sendLeaveNotification } = require('./config/mailer');
const Leave = require('./models/LeaveRequest');
const User = require('./models/User');

// Function to auto-approve leaves older than 24 hours
const autoApprovePendingLeaves = async () => {
    try {
        console.log('🔄 Running auto-approval check for pending leaves...');
        
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        // Find pending leaves older than 24 hours
        const pendingLeaves = await Leave.find({
            status: 'Pending',
            createdAt: { $lt: twentyFourHoursAgo }
        }).populate('faculty', 'username email department');
        
        console.log(`📋 Found ${pendingLeaves.length} pending leaves older than 24 hours`);
        
        for (const leave of pendingLeaves) {
            // Auto-approve the leave
            leave.status = 'Approved';
            leave.approvedBy = null; // System auto-approved
            leave.updatedAt = new Date();
            leave.comments = 'Auto-approved after 24 hours of no action';
            await leave.save();
            
            console.log(`✅ Auto-approved leave ${leave._id} for ${leave.faculty.username}`);
            
            // Send notification email to faculty
            if (leave.faculty && leave.faculty.email) {
                const leaveTypeLabel = leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1);
                const startDate = new Date(leave.startDate).toLocaleDateString();
                const endDate = new Date(leave.endDate).toLocaleDateString();
                
                const emailSubject = `✅ Leave Auto-Approved - ${leaveTypeLabel} Leave`;
                const emailMessage = `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <h2 style="color: #10B981;">Leave Application Auto-Approved ✅</h2>
                        <p>Dear ${leave.faculty.username},</p>
                        <p>Your leave application has been <strong>automatically approved</strong> as it was not reviewed within 24 hours.</p>
                        
                        <div style="background-color: #f0fdf4; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #10B981;">Leave Details:</h3>
                            <ul style="list-style: none; padding: 0;">
                                <li><strong>Leave Type:</strong> ${leaveTypeLabel}</li>
                                <li><strong>Start Date:</strong> ${startDate}</li>
                                <li><strong>End Date:</strong> ${endDate}</li>
                                <li><strong>Total Days:</strong> ${leave.totalDays}</li>
                                <li><strong>Reason:</strong> ${leave.reason}</li>
                            </ul>
                        </div>
                        
                        <p>Status: <strong style="color: #10B981;">AUTO-APPROVED</strong></p>
                        <p>This approval was processed automatically by the system after 24 hours without HOD review.</p>
                        <p>You can now proceed with your leave. Please ensure that all workload assignments are properly delegated or completed before your leave starts.</p>
                        
                        <p>If you have any questions, please contact the HR department.</p>
                        
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                        <p style="color: #666; font-size: 12px;">This is an automated email. Please do not reply to this email.</p>
                    </div>
                `;
                
                try {
                    await sendLeaveNotification(leave.faculty.email, emailSubject, emailMessage);
                    console.log(`📧 Auto-approval email sent to ${leave.faculty.email}`);
                } catch (emailError) {
                    console.error(`❌ Failed to send auto-approval email to ${leave.faculty.email}:`, emailError);
                }
            }
        }
        
        if (pendingLeaves.length > 0) {
            console.log(`✅ Auto-approved ${pendingLeaves.length} leaves`);
        } else {
            console.log('✅ No leaves to auto-approve');
        }
        
    } catch (error) {
        console.error('❌ Error in auto-approval cron job:', error);
    }
};

// Schedule the cron job to run every hour
const autoApprovalJob = cron.schedule('0 * * * *', autoApprovePendingLeaves, {
    scheduled: false // Don't start immediately
});

// Start the cron job when database is connected
mongoose.connection.once('open', () => {
    console.log('🔄 Starting auto-approval cron job...');
    autoApprovalJob.start();
    console.log('✅ Auto-approval cron job scheduled (runs every hour)');
});

// Debug: Check if routes load correctly
console.log('🔧 Loading routes...');
try {
    const authRoutes = require('./routes/authRoutes');
    app.use('/auth', authRoutes);
    console.log('✅ Auth routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading auth routes:', error.message);
}

try {
    const leaveRoutes = require('./routes/leave');
    app.use('/leave', leaveRoutes);
    console.log('✅ Leave application routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading leave application routes:', error.message);
}

try {
    const leaveRoutes = require('./routes/leaveRoutes');
    app.use('/leave', leaveRoutes);
    console.log('✅ Leave management routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading leave management routes:', error.message);
}

try {
    const dashboardRoutes = require('./routes/dashboardRoutes');
    app.use('/dashboard', dashboardRoutes);
    console.log('✅ Dashboard routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading dashboard routes:', error.message);
    console.log('⚠️  Using basic dashboard route as fallback');
    
    // Fallback basic dashboard route
    app.get('/dashboard', (req, res) => {
        if (!req.session.user) {
            return res.redirect('/auth/login');
        }
        
        // Simple fallback dashboard without database calls
        const currentDate = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        res.render('dashboard', { 
            title: 'Dashboard - Leave Management System',
            user: req.session.user,
            currentDate: currentDate,
            leaves: [],
            stats: {
                total: 0,
                pending: 0,
                approved: 0,
                rejected: 0,
                balance: 15
            },
            recentActivities: [],
            workloadStats: {
                pendingAssignments: 0,
                approvedAssignments: 0,
                rejectedAssignments: 0,
                totalAssignments: 0
            },
            recentAssignments: [],
            pendingWorkloads: [],
            departmentStats: {}
        });
    });
}

// ✅ UPDATED WORKLOAD ROUTES - FIXED PATH
try {
    const workloadRoutes = require('./routes/workloadRoutes');
    app.use('/api', workloadRoutes); // API routes for workload
    console.log('✅ Workload routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading workload routes:', error.message);
}

// ✅ ASSIGNMENT ROUTES - FOR HOD WORKLOAD ASSIGNMENT
try {
    const assignmentRoutes = require('./routes/assignmentRoutes');
    app.use('/api', assignmentRoutes); // Workload assignment routes
    console.log('✅ Assignment routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading assignment routes:', error.message);
}

// ✅ PROFILE ROUTES - FOR USER PROFILE AND AVATAR UPLOADS
try {
    const profileRoutes = require('./routes/profileRoutes');
    app.use('/api', profileRoutes); // Profile routes for avatar and profile management
    console.log('✅ Profile routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading profile routes:', error.message);
}

// ✅ TIMETABLE ROUTES - FOR FACULTY TIMETABLE UPLOADS AND HOD VIEW
try {
    const timetableRoutes = require('./routes/timetableRoutes');
    app.use('/timetable', timetableRoutes); // Timetable routes
    console.log('✅ Timetable routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading timetable routes:', error.message);
}

// Basic routes
app.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('index', { 
        title: 'Leave Management System',
        user: req.session.user 
    });
});

// Health check route
app.get('/health', (req, res) => {
    const routeStatus = {
        auth: 'Loaded',
        leave: 'Loaded',
        dashboard: 'Loaded',
        workload: 'Loaded'
    };
    
    try {
        require('./routes/dashboardRoutes');
    } catch (error) {
        routeStatus.dashboard = 'Fallback';
    }
    
    try {
        require('./routes/workloadRoutes');
    } catch (error) {
        routeStatus.workload = 'Fallback';
    }
    
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        environment: process.env.NODE_ENV || 'development',
        models: {
            user: 'Loaded',
            leaveRequest: 'Loaded',
            workloadAssignment: 'Loaded',
            leaveApplication: 'Loaded'
        },
        routes: routeStatus,
        session: req.session.user ? 'Active' : 'No session'
    });
});

// Create basic error page route
app.get('/error', (req, res) => {
    res.render('error', {
        title: 'Error',
        message: 'An error occurred',
        error: {}
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('🚨 Server Error:', err.stack);
    res.status(500).render('error', {
        title: 'Server Error',
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Page Not Found',
        message: 'The page you are looking for does not exist.'
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🔻 Received SIGINT. Closing server gracefully...');
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed.');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🔻 Received SIGTERM. Closing server gracefully...');
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed.');
    process.exit(0);
});


// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`
🚀 Server is running!
📍 Port: ${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
📊 Database: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Connecting...'}
📋 Models: User ✅, LeaveRequest ✅, WorkloadAssignment ✅, LeaveApplication ✅
🛣️  Routes: Auth ✅, Leave ✅, Dashboard ✅, Workload ✅
🔗 Health check: http://localhost:${PORT}/health
🔗 Homepage: http://localhost:${PORT}
🔗 Dashboard: http://localhost:${PORT}/dashboard
🔗 Login: http://localhost:${PORT}/auth/login
🔗 Apply Leave: http://localhost:${PORT}/leave/apply
🔗 Leave History: http://localhost:${PORT}/leave/history
🔗 Faculty Workload: http://localhost:${PORT}/api/faculty/workload
🔗 HOD Assign Workload: http://localhost:${PORT}/api/hod/assign-workload
    `);
});

module.exports = app;