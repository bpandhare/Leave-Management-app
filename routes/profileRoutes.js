const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');

const router = express.Router();

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ 
            success: false,
            error: 'Please log in to access this resource' 
        });
    }
    next();
};

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../public/uploads/avatars');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename: userId_timestamp_originalname
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, req.session.user._id + '_' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // Allowed file types
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    
    const ext = path.extname(file.originalname).toLowerCase();
    const isAllowedMime = allowedMimes.includes(file.mimetype);
    const isAllowedExt = allowedExtensions.includes(ext);
    
    if (isAllowedMime && isAllowedExt) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (JPG, PNG, GIF, WebP)'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max file size
    }
});

/**
 * GET /api/profile
 * Get current user profile information
 */
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user._id;
        const user = await User.findById(userId).select('-password');
        
        if (!user) {
            return res.status(404).json({ 
                success: false,
                error: 'User not found' 
            });
        }

        res.json({
            success: true,
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                department: user.department,
                phone: user.phone,
                avatar: user.avatar,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch profile' 
        });
    }
});

/**
 * POST /api/profile/avatar
 * Upload user avatar
 */
router.post('/profile/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        const userId = req.session.user._id;
        
        // Get current user to check for existing avatar
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Delete old avatar if it exists
        if (user.avatar) {
            const oldAvatarPath = path.join(__dirname, '../public', user.avatar);
            if (fs.existsSync(oldAvatarPath)) {
                fs.unlinkSync(oldAvatarPath);
            }
        }

        // Update user with new avatar path
        const avatarPath = `/uploads/avatars/${req.file.filename}`;
        user.avatar = avatarPath;
        await user.save();

        // Update session data
        req.session.user.avatar = avatarPath;

        res.json({
            success: true,
            message: 'Avatar uploaded successfully',
            avatar: avatarPath,
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error('Avatar upload error:', error);
        
        // Delete uploaded file if there was an error
        if (req.file) {
            const filePath = path.join(uploadDir, req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        res.status(400).json({
            success: false,
            error: error.message || 'Failed to upload avatar'
        });
    }
});

/**
 * DELETE /api/profile/avatar
 * Delete user avatar
 */
router.delete('/profile/avatar', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user._id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        if (user.avatar) {
            const avatarPath = path.join(__dirname, '../public', user.avatar);
            if (fs.existsSync(avatarPath)) {
                fs.unlinkSync(avatarPath);
            }
            user.avatar = null;
            await user.save();
            req.session.user.avatar = null;
        }

        res.json({
            success: true,
            message: 'Avatar deleted successfully'
        });
    } catch (error) {
        console.error('Avatar deletion error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete avatar'
        });
    }
});

/**
 * PUT /api/profile
 * Update user profile information
 */
router.put('/profile', requireAuth, async (req, res) => {
    try {
        const { phone, department } = req.body;
        const userId = req.session.user._id;

        const updateData = {};
        
        if (phone) updateData.phone = phone;
        if (department) updateData.department = department;

        const user = await User.findByIdAndUpdate(userId, updateData, { new: true }).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Update session
        Object.assign(req.session.user, updateData);

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                department: user.department,
                phone: user.phone,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to update profile'
        });
    }
});

module.exports = router;
