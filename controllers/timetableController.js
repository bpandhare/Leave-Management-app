const Timetable = require('../models/Timetable');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../public/uploads/timetables');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Upload new timetable for faculty
exports.uploadTimetable = async (req, res) => {
    try {
        console.log('Upload timetable request received');
        console.log('req.body:', req.body);
        console.log('req.files:', req.files);

        // Validate that body data exists
        if (!req.body) {
            console.log('req.body is undefined');
            return res.status(400).json({
                success: false,
                message: 'Request body is undefined. Please ensure the form is sending data correctly.'
            });
        }

        if (typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
            console.log('req.body is not an object or is empty:', typeof req.body);
            return res.status(400).json({
                success: false,
                message: 'Request body is not valid. Please ensure the form is sending data correctly.'
            });
        }

        const startDate = req.body?.startDate;
        const endDate = req.body?.endDate;
        const description = req.body?.description;
        const classesData = req.body?.classesData;
        const userId = req.session.user._id;
        const userDepartment = req.session.user.department;

        // Validate dates
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Please provide start and end dates for the week'
            });
        }

        // Check if file was uploaded
        if (!req.files || !req.files.timetableFile) {
            return res.status(400).json({
                success: false,
                message: 'Please upload a timetable file'
            });
        }

        const file = req.files.timetableFile;
        const allowedExtensions = ['.pdf', '.xlsx', '.xls', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
        const fileExtension = path.extname(file.name).toLowerCase();

        // Validate file type
        if (!allowedExtensions.includes(fileExtension)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid file type. Allowed: PDF, Excel, Word, Image files'
            });
        }

        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            return res.status(400).json({
                success: false,
                message: 'File size exceeds 10MB limit'
            });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const filename = `timetable_${userId}_${timestamp}${fileExtension}`;
        const filepath = path.join(uploadsDir, filename);

        // Save file
        await file.mv(filepath);

        // Parse classes data if provided
        let classes = [];
        if (classesData) {
            try {
                classes = JSON.parse(classesData);
            } catch (e) {
                classes = [];
            }
        }

        // Check if timetable for this week already exists
        const existingTimetable = await Timetable.findOne({
            faculty: userId,
            'week.startDate': new Date(startDate),
            'week.endDate': new Date(endDate)
        });

        let timetable;

        if (existingTimetable) {
            // Update existing timetable
            // Delete old file
            if (fs.existsSync(existingTimetable.timetableFile.filepath)) {
                fs.unlinkSync(existingTimetable.timetableFile.filepath);
            }

            existingTimetable.timetableFile = {
                filename,
                filepath,
                originalname: file.name,
                filesize: file.size,
                mimetype: file.mimetype
            };
            existingTimetable.description = description || '';
            existingTimetable.classes = classes;
            existingTimetable.updatedAt = new Date();

            timetable = await existingTimetable.save();
        } else {
            // Create new timetable
            timetable = new Timetable({
                faculty: userId,
                week: {
                    startDate: new Date(startDate),
                    endDate: new Date(endDate)
                },
                timetableFile: {
                    filename,
                    filepath,
                    originalname: file.name,
                    filesize: file.size,
                    mimetype: file.mimetype
                },
                description: description || '',
                classes,
                uploadedBy: userId,
                department: userDepartment,
                isActive: true
            });

            timetable = await timetable.save();
        }

        res.json({
            success: true,
            message: 'Timetable uploaded successfully',
            timetable
        });
    } catch (error) {
        console.error('Error uploading timetable:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading timetable: ' + error.message
        });
    }
};

// Get faculty's timetables
exports.getFacultyTimetables = async (req, res) => {
    try {
        const userId = req.session.user._id;

        const timetables = await Timetable.find({ faculty: userId })
            .populate('faculty', 'username email department')
            .sort({ 'week.startDate': -1 });

        res.json({
            success: true,
            timetables
        });
    } catch (error) {
        console.error('Error fetching timetables:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching timetables'
        });
    }
};

// Get single timetable details
exports.getTimetableById = async (req, res) => {
    try {
        const { id } = req.params;

        const timetable = await Timetable.findById(id)
            .populate('faculty', 'username email department')
            .populate('uploadedBy', 'username');

        if (!timetable) {
            return res.status(404).json({
                success: false,
                message: 'Timetable not found'
            });
        }

        res.json({
            success: true,
            timetable
        });
    } catch (error) {
        console.error('Error fetching timetable:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching timetable'
        });
    }
};

// Get all faculty timetables for HOD
exports.getAllFacultyTimetables = async (req, res) => {
    try {
        const hodDepartment = req.session.user.department;

        // Get all faculty in HOD's department
        const facultyMembers = await User.find({
            department: hodDepartment,
            role: { $regex: /faculty/i },
            isActive: true
        }).select('_id username email department');

        // Get latest timetable for each faculty
        const timetables = await Promise.all(
            facultyMembers.map(async (faculty) => {
                const latestTimetable = await Timetable.findOne({
                    faculty: faculty._id
                })
                    .sort({ 'week.startDate': -1 })
                    .limit(1);

                return {
                    faculty: {
                        _id: faculty._id,
                        username: faculty.username,
                        email: faculty.email,
                        department: faculty.department
                    },
                    latestTimetable
                };
            })
        );

        res.json({
            success: true,
            timetables: timetables.filter(t => t.latestTimetable)
        });
    } catch (error) {
        console.error('Error fetching all faculty timetables:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching faculty timetables'
        });
    }
};

// Get specific faculty's timetables for HOD
exports.getFacultyTimetablesForHOD = async (req, res) => {
    try {
        const { facultyId } = req.params;

        const timetables = await Timetable.find({ faculty: facultyId })
            .populate('faculty', 'username email department')
            .sort({ 'week.startDate': -1 });

        if (!timetables || timetables.length === 0) {
            return res.json({
                success: true,
                timetables: [],
                message: 'No timetables found for this faculty'
            });
        }

        res.json({
            success: true,
            timetables
        });
    } catch (error) {
        console.error('Error fetching faculty timetables:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching faculty timetables'
        });
    }
};

// Download timetable file
exports.downloadTimetable = async (req, res) => {
    try {
        const { id } = req.params;

        const timetable = await Timetable.findById(id);

        if (!timetable) {
            return res.status(404).json({
                success: false,
                message: 'Timetable not found'
            });
        }

        const filepath = timetable.timetableFile.filepath;

        // Check if file exists
        if (!fs.existsSync(filepath)) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        res.download(filepath, timetable.timetableFile.originalname);
    } catch (error) {
        console.error('Error downloading timetable:', error);
        res.status(500).json({
            success: false,
            message: 'Error downloading timetable'
        });
    }
};

// Delete timetable
exports.deleteTimetable = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.user._id;

        const timetable = await Timetable.findById(id);

        if (!timetable) {
            return res.status(404).json({
                success: false,
                message: 'Timetable not found'
            });
        }

        // Check authorization - only faculty who owns it or HOD can delete
        if (timetable.faculty.toString() !== userId.toString() && req.session.user.role.toLowerCase() !== 'hod') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this timetable'
            });
        }

        // Delete file from server
        if (fs.existsSync(timetable.timetableFile.filepath)) {
            fs.unlinkSync(timetable.timetableFile.filepath);
        }

        // Delete from database
        await Timetable.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'Timetable deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting timetable:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting timetable'
        });
    }
};

// Get timetable as HTML (render view)
exports.viewTimetable = async (req, res) => {
    try {
        const { id } = req.params;

        const timetable = await Timetable.findById(id)
            .populate('faculty', 'username email department');

        if (!timetable) {
            return res.render('error', {
                error: 'Timetable not found',
                user: req.session.user
            });
        }

        const startDate = timetable.week.startDate.toLocaleDateString('en-IN');
        const endDate = timetable.week.endDate.toLocaleDateString('en-IN');

        res.render('leave/timetable-view', {
            title: `Timetable - ${timetable.faculty.username}`,
            timetable,
            startDate,
            endDate,
            user: req.session.user,
            success: req.session.success,
            error: req.session.error
        });

        req.session.success = null;
        req.session.error = null;
    } catch (error) {
        console.error('Error viewing timetable:', error);
        res.render('error', {
            error: 'Error loading timetable',
            user: req.session.user
        });
    }
};
