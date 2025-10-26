// Authentication middleware
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

// Role-based authorization middleware
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.session.user) {
            return res.redirect('/login');
        }
        
        if (!roles.includes(req.session.user.role)) {
            return res.redirect('/dashboard?error=Access denied');
        }
        
        next();
    };
};

// Check if user is already logged in (for login/register pages)
const redirectIfAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    next();
};

module.exports = {
    requireAuth,
    requireRole,
    redirectIfAuthenticated
};