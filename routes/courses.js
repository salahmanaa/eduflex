const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Course = require('../models/Course');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/courses');
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'thumbnail') {
      file.mimetype.startsWith('image/') 
        ? cb(null, true)
        : cb(new Error('Thumbnail must be an image file'));
    } else if (file.fieldname === 'files') {
      file.mimetype === 'application/pdf'
        ? cb(null, true)
        : cb(new Error('Only PDF files are allowed'));
    } else {
      cb(null, true);
    }
  }
});

// Get courses based on user role
router.get('/', auth, async (req, res) => {
  try {
    console.log('User from auth middleware:', req.user);
    let courses;
    if (req.user.role === 'teacher') {
      // Fixed: use 'instructor' instead of 'teacher'
      courses = await Course.find({ instructor: req.user._id })
        .populate('students.studentId', 'firstName lastName email')
        .populate('instructor', 'firstName lastName email')
        .sort({ createdAt: -1 });
    } else if (req.user.role === 'student') {
      courses = await Course.find({ 
        'students.studentId': req.user._id,
        isActive: true
      }).populate('instructor', 'firstName lastName email').sort({ createdAt: -1 });
    } else {
      courses = await Course.find()
        .populate('instructor students.studentId', 'firstName lastName email')
        .sort({ createdAt: -1 });
    }
    console.log('Found courses:', courses.length);
    res.json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// Get available courses for students
router.get('/available', auth, async (req, res) => {
  try {
    const { category, level, search } = req.query;
    const query = { isActive: true };
    
    if (category) query.category = category;
    if (level) query.level = level;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const courses = await Course.find(query)
      .populate('instructor', 'firstName lastName email')
      .select('-content')
      .sort({ createdAt: -1 });
    
    res.json(courses);
  } catch (error) {
    console.error('Error fetching available courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// Create new course
router.post('/', auth, upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'files', maxCount: 10 }
]), async (req, res) => {
  try {
    // Add validation for required fields
    const requiredFields = ['title', 'description', 'category', 'level'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    const courseData = {
      title: req.body.title.trim(),
      description: req.body.description.trim(),
      category: req.body.category,
      level: req.body.level,
      instructor: req.user._id,
      duration: parseInt(req.body.duration) || 0,
      price: parseFloat(req.body.price) || 0,
      isActive: true
    };

    // Handle thumbnail upload
    if (req.files?.thumbnail?.[0]) {
      courseData.thumbnail = `/uploads/courses/${req.files.thumbnail[0].filename}`;
    }

    // Create course first
    const course = new Course(courseData);

    // Handle PDF files upload
    if (req.files?.files) {
      const pdfFiles = req.files.files;
      course.content = pdfFiles.map((file, index) => ({
        type: 'pdf',
        title: file.originalname.replace(/\.[^/.]+$/, ''), // Remove file extension
        content: {
          fileName: file.originalname,
          filePath: path.join(__dirname, '..', 'uploads', 'courses', file.filename),
          fileUrl: `/uploads/courses/${file.filename}`
        },
        order: index
      }));
    }

    await course.save();
    
    // Populate instructor details before sending response
    await course.populate('instructor', 'firstName lastName email');
    
    res.status(201).json(course);
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enroll in course
router.post('/:id/enroll', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can enroll' });
    }

    const course = await Course.findById(req.params.id);
    if (!course || !course.isActive) {
      return res.status(404).json({ error: 'Course not available' });
    }

    const isEnrolled = course.students.some(s => 
      s.studentId.toString() === req.user._id.toString()
    );
    
    if (isEnrolled) {
      return res.status(400).json({ error: 'Already enrolled' });
    }

    if (course.students.length >= course.maxStudents) {
      return res.status(400).json({ error: 'Course is full' });
    }

    course.students.push({ studentId: req.user._id, progress: 0 });
    await course.save();
    res.json({ message: 'Enrollment successful', course });
  } catch (error) {
    console.error('Enrollment error:', error);
    res.status(500).json({ error: 'Failed to enroll' });
  }
});

// Update course
router.put('/:id', auth, upload.fields([
  { name: 'thumbnail', maxCount: 1 }
]), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    // Fixed: use 'instructor' instead of 'teacher'
    if (course.instructor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    const updates = Object.keys(req.body);
    const allowedUpdates = ['title', 'description', 'category', 'level', 'maxStudents', 'tags', 'isActive', 'duration', 'price'];
    
    updates.forEach(update => {
      if (allowedUpdates.includes(update)) {
        course[update] = req.body[update];
      }
    });

    if (req.files?.thumbnail?.[0]) {
      course.thumbnail = `/uploads/courses/${req.files.thumbnail[0].filename}`;
    }

    await course.save();
    await course.populate('instructor', 'firstName lastName email');
    res.json(course);
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

// Delete course
router.delete('/:id', auth, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    // Fixed: use 'instructor' instead of 'teacher'
    if (course.instructor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    // Delete associated files
    const deletePromises = course.content.map(async item => {
      if (item.content?.filePath) {
        await fs.unlink(item.content.filePath).catch(console.error);
      }
    });

    if (course.thumbnail) {
      const thumbPath = path.join(__dirname, '..', course.thumbnail);
      await fs.unlink(thumbPath).catch(console.error);
    }

    await Promise.all(deletePromises);
    await course.deleteOne();
    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

// Download course PDF
router.get('/:courseId/pdf/:fileId', auth, async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Check if user is enrolled in the course or is the instructor
    const isEnrolled = course.students.some(s => s.studentId.toString() === req.user._id.toString());
    const isInstructor = course.instructor.toString() === req.user._id.toString();
    
    if (!isEnrolled && !isInstructor && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to access this resource' });
    }

    // Find the content item with the requested fileId
    const contentItem = course.content.find(item => 
      item._id.toString() === req.params.fileId && item.type === 'pdf'
    );

    if (!contentItem || !contentItem.content.filePath) {
      return res.status(404).json({ error: 'PDF file not found' });
    }

    // Send the file
    res.download(contentItem.content.filePath, contentItem.content.fileName);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

module.exports = router;