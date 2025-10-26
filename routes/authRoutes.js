// routes/authRoutes.js
const express = require('express');
const User = require('../models/User');
const router = express.Router();

// Debug middleware
router.use((req, res, next) => {
    console.log(`🔍 ${req.method} ${req.path}`);
    console.log('📋 Session ID:', req.sessionID);
    console.log('👤 Session user:', req.session.user);
    next();
});

// Register page
router.get('/register', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('auth/register', { 
        title: 'Register - Leave Management System',
        error: null,
        formData: {},
        user: null
    });
});

// Login page
router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('auth/login', { 
        title: 'Login - Leave Management System',
        error: null,
        formData: {},
        user: null
    });
});

// Register user
router.post('/register', async (req, res) => {
    try {
        console.log('📝 REGISTRATION ATTEMPT');
        console.log('Session ID:', req.sessionID);
        
        const { username, email, password, confirmPassword, department, phone, role, agreeTerms } = req.body;
        
        // Basic validation
        const requiredFields = { username, email, password, confirmPassword, department, phone, role };
        const missingFields = Object.keys(requiredFields).filter(field => !requiredFields[field]);
        
        if (missingFields.length > 0) {
            console.log('❌ Missing fields:', missingFields);
            return res.render('auth/register', { 
                title: 'Register - Leave Management System',
                error: `Missing required fields: ${missingFields.join(', ')}`,
                formData: req.body,
                user: null
            });
        }

        if (!agreeTerms) {
            return res.render('auth/register', { 
                title: 'Register - Leave Management System',
                error: 'You must agree to the terms and conditions',
                formData: req.body,
                user: null
            });
        }

        if (password !== confirmPassword) {
            return res.render('auth/register', { 
                title: 'Register - Leave Management System',
                error: 'Passwords do not match',
                formData: req.body,
                user: null
            });
        }

        if (password.length < 6) {
            return res.render('auth/register', { 
                title: 'Register - Leave Management System',
                error: 'Password must be at least 6 characters long',
                formData: req.body,
                user: null
            });
        }

        // Check if user exists
        const existingUser = await User.findOne({ 
            $or: [
                { email: email.toLowerCase().trim() },
                { username: username.toLowerCase().trim() }
            ]
        });

        if (existingUser) {
            let errorMessage = 'User already exists. ';
            if (existingUser.email === email.toLowerCase().trim()) {
                errorMessage += 'This email is already registered.';
            } else {
                errorMessage += 'This username is already taken.';
            }
            return res.render('auth/register', { 
                title: 'Register - Leave Management System',
                error: errorMessage,
                formData: req.body,
                user: null
            });
        }

        // HOD Validation - Only one HOD per department
        if (role === 'HOD') {
            const existingHOD = await User.findOne({ 
                role: 'HOD', 
                department: department 
            });
            
            if (existingHOD) {
                return res.render('auth/register', { 
                    title: 'Register - Leave Management System',
                    error: `HOD for ${department} department already exists. Please select a different department or contact administration.`,
                    formData: req.body,
                    user: null
                });
            }
        }

        // Create new user
        const user = new User({
            username: username.toLowerCase().trim(),
            email: email.toLowerCase().trim(),
            password: password,
            department: department.trim(),
            phone: phone.trim(),
            role: role
        });

        await user.save();
        console.log('✅ User registered successfully:', user.username);
        
        // Set session with BOTH id and _id fields
        req.session.user = {
            _id: user._id.toString(), // Add this line
            id: user._id.toString(),
            username: user.username,
            email: user.email,
            role: user.role,
            department: user.department
        };

        // Manually save session to ensure it's persisted
        req.session.save((err) => {
            if (err) {
                console.error('🚨 Session save error:', err);
                return res.redirect('/auth/login?error=Session error, please login manually');
            }
            console.log('💾 Session saved successfully');
            console.log('📋 Session user after save:', req.session.user);
            res.redirect('/dashboard?success=Registration successful! Welcome to Leave Management System');
        });

    } catch (error) {
        console.error('🚨 REGISTRATION ERROR:', error);
        
        let errorMessage = 'Registration failed. Please try again.';
        
        if (error.code === 11000) {
            errorMessage = 'User with this email or username already exists.';
        } else if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(e => e.message);
            errorMessage = validationErrors.join(', ');
        }
        
        res.render('auth/register', { 
            title: 'Register - Leave Management System',
            error: errorMessage,
            formData: req.body,
            user: null
        });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log('🔐 LOGIN ATTEMPT for:', email);
        console.log('Session ID:', req.sessionID);
        
        // Find user
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            console.log('❌ User not found:', email);
            return res.render('auth/login', { 
                title: 'Login - Leave Management System',
                error: 'Invalid email or password',
                formData: req.body,
                user: null
            });
        }

        console.log('👤 User found:', user.username);

        // Check password
        const isPasswordValid = await user.comparePassword(password);
        console.log('🔑 Password valid:', isPasswordValid);

        if (!isPasswordValid) {
            console.log('❌ Invalid password for user:', user.username);
            return res.render('auth/login', { 
                title: 'Login - Leave Management System',
                error: 'Invalid email or password',
                formData: req.body,
                user: null
            });
        }

        if (!user.isActive) {
            console.log('❌ Account deactivated for user:', user.username);
            return res.render('auth/login', { 
                title: 'Login - Leave Management System',
                error: 'Account is deactivated. Contact administrator.',
                formData: req.body,
                user: null
            });
        }

        // Set session with BOTH id and _id fields
        req.session.user = {
            _id: user._id.toString(), // Add this line
            id: user._id.toString(),
            username: user.username,
            email: user.email,
            role: user.role,
            department: user.department
        };

        console.log('✅ Login successful for:', user.username);
        console.log('📋 Session user set:', req.session.user);

        // Manually save session to ensure it's persisted
        req.session.save((err) => {
            if (err) {
                console.error('🚨 Session save error:', err);
                return res.redirect('/auth/login?error=Session error, please try again');
            }
            console.log('💾 Session saved successfully');
            res.redirect('/dashboard?success=Login successful! Welcome back');
        });

    } catch (error) {
        console.error('🚨 LOGIN ERROR:', error);
        res.render('auth/login', { 
            title: 'Login - Leave Management System',
            error: 'Login failed. Please try again.',
            formData: req.body,
            user: null
        });
    }
});

// Logout
router.post('/logout', (req, res) => {
    console.log('👋 Logout user:', req.session.user?.username);
    req.session.destroy((err) => {
        if (err) {
            console.error('🚨 Logout error:', err);
            return res.redirect('/dashboard');
        }
        res.redirect('/?message=Logged out successfully');
    });
});

router.get('/logout', (req, res) => {
    console.log('👋 GET Logout user:', req.session.user?.username);
    req.session.destroy((err) => {
        if (err) {
            console.error('🚨 Logout error:', err);
            return res.redirect('/dashboard');
        }
        res.redirect('/?message=Logged out successfully');
    });
});

// Debug route to check session
router.get('/debug-session', (req, res) => {
    res.json({
        sessionID: req.sessionID,
        session: req.session,
        user: req.session.user
    });
});

module.exports = router;