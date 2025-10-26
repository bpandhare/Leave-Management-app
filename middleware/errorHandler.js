// Global error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(error => error.message);
        return res.status(400).render('error', {
            title: 'Validation Error',
            error: errors.join(', '),
            user: req.session.user
        });
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(400).render('error', {
            title: 'Duplicate Entry',
            error: `${field} already exists`,
            user: req.session.user
        });
    }

    // Mongoose CastError (invalid ObjectId)
    if (err.name === 'CastError') {
        return res.status(400).render('error', {
            title: 'Invalid ID',
            error: 'Invalid resource ID',
            user: req.session.user
        });
    }

    // Default error
    res.status(err.status || 500).render('error', {
        title: 'Server Error',
        error: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message,
        user: req.session.user
    });
};

module.exports = errorHandler;