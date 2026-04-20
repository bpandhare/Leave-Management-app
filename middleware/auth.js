// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Main authentication function
const auth = async (req, res, next) => {
    try {
        // Check session first (for EJS views)
        if (req.session.user) {
            // If we have session user, verify it's still valid
            try {
                const user = await User.findById(req.session.user._id);
                if (user) {
                    req.user = user;
                    req.session.user = user; // Refresh session data
                    return next();
                }
            } catch (error) {
                // User not found, clear session
                req.session.destroy();
                return res.redirect('/auth/login');
            }
        }

        // Check JWT token (for API calls)
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
                const user = await User.findById(decoded.userId);
                
                if (user) {
                    req.user = user;
                    // Also set session for consistency
                    req.session.user = user;
                    return next();
                }
            } catch (error) {
                // Invalid token, continue to other checks
            }
        }

        // No valid authentication found
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(401).json({ 
                success: false,
                message: 'Authentication required' 
            });
        }
        
        req.session.error = 'Please log in to access this resource';
        return res.redirect('/auth/login');
        
    } catch (error) {
        console.error('Auth middleware error:', error);
        
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(500).json({ 
                success: false,
                message: 'Authentication error' 
            });
        }
        
            req.session.error = 'Authentication error';
        return res.redirect('/auth/login');
    }
};

// Ensure user is authenticated
const ensureAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    
    if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ 
            success: false,
            message: 'Please log in to view this resource' 
        });
    }
    
    req.session.error = 'Please log in to view this resource';
    res.redirect('/auth/login');
};

// Ensure user is guest (not authenticated)
const ensureGuest = (req, res, next) => {
    if (!req.session.user) {
        return next();
    }
    res.redirect('/dashboard');
};

// Ensure user is HOD
const ensureHOD = (req, res, next) => {
    if (req.session.user && req.session.user.role.toLowerCase() === 'hod') {
        return next();
    }
    
    if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({ 
            success: false,
            message: 'Access denied. HOD privileges required.' 
        });
    }
    
    req.session.error = 'Access denied. HOD privileges required.';
    res.redirect('/dashboard');
};

// Ensure user is Faculty
const ensureFaculty = (req, res, next) => {
    if (req.session.user && req.session.user.role.toLowerCase() === 'faculty') {
        return next();
    }
    
    if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({ 
            success: false,
            message: 'Access denied. Faculty privileges required.' 
        });
    }
    
    req.session.error = 'Access denied. Faculty privileges required.';
    res.redirect('/dashboard');
};

// Check if user has specific role
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.session.user) {
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(401).json({ 
                    success: false,
                    message: 'Authentication required' 
                });
            }
            req.session.error = 'Please log in to view this resource';
            return res.redirect('/auth/login');
        }

        const userRole = req.session.user.role.toLowerCase();
        const allowedRoles = Array.isArray(roles) ? roles.map(r => r.toLowerCase()) : [roles.toLowerCase()];
        
        if (!allowedRoles.includes(userRole)) {
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(403).json({ 
                    success: false,
                    message: `Access denied. Required roles: ${roles.join(', ')}` 
                });
            }
            
            req.session.error = `Access denied. Required role: ${roles.join(' or ')}`;
            return res.redirect('/dashboard');
        }
        
        next();
    };
};

module.exports = {
    auth,
    ensureAuthenticated,
    ensureGuest,
    ensureHOD,
    ensureFaculty,
    requireRole
};