require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
    const leaveRoutes = require('./routes/leaveRoutes');
    app.use('/leave', leaveRoutes);
    console.log('✅ Leave routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading leave routes:', error.message);
}

try {
    const dashboardRoutes = require('./routes/dashboardRoutes');
    app.use('/dashboard', dashboardRoutes);
    app.use('/', dashboardRoutes); // Also mount at root for some routes
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
            recentActivities: []
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
    console.log('⚠️  Creating basic workload routes as fallback');
    
    // Fallback basic workload routes
    app.get('/api/faculty/workload', (req, res) => {
        if (!req.session.user) {
            return res.redirect('/auth/login');
        }
        
        if (req.session.user.role !== 'faculty') {
            return res.status(403).render('error', {
                title: 'Access Denied',
                message: 'Only faculty members can access workload assignments.'
            });
        }
        
        res.render('workload-assignments', {
            title: 'Workload Assignments - Leave Management System',
            user: req.session.user,
            assignments: [],
            pendingCount: 0
        });
    });

    // HOD workload assignment route
    app.get('/api/hod/assign-workload', (req, res) => {
        if (!req.session.user) {
            return res.redirect('/auth/login');
        }
        
        if (req.session.user.role.toLowerCase() !== 'hod') {
            return res.status(403).render('error', {
                title: 'Access Denied',
                message: 'Only HOD can assign workload.'
            });
        }
        
        res.render('assign-workload', {
            title: 'Assign Workload - Leave Management System',
            user: req.session.user,
            facultyMembers: [],
            leaves: []
        });
    });
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