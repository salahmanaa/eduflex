// routes/teacherRoutes.js - CORRECTED VERSION
const express = require('express');
console.log('--- [profRoutes.js] File loaded ---');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const User = require('../models/User');
const Course = require('../models/Course');
const fs = require('fs');
const { Parser } = require('json2csv');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const Devoir = require('../models/Devoir');
const { getDashboardStats, getProfile } = require('../controllers/profController');

// Create upload directory
// Create upload directory
const uploadDir = 'public/uploads/teachers/profile-photos/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure file storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `teacher-${req.user.id}-${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Multer config for PDF upload
const devoirUploadDir = path.join(__dirname, '../uploads/devoirs');
if (!fs.existsSync(devoirUploadDir)) {
    fs.mkdirSync(devoirUploadDir, { recursive: true });
}
const devoirStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, devoirUploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `devoir-${Date.now()}${ext}`);
    }
});
const devoirUpload = multer({
    storage: devoirStorage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Seuls les fichiers PDF sont autorisés.'), false);
        }
    }
});

// Teacher middleware
const isTeacher = async (req, res, next) => {
    try {
        console.log('Session user ID:', req.session.user?._id);
        if (!req.session.user?._id) {
            return res.status(401).json({ 
                success: false,
                message: 'Non authentifié' 
            });
        }

        const user = await User.findById(req.session.user._id);
        if (!user || user.role !== 'teacher') {
            console.log('Access denied - User:', user);
            return res.status(403).json({ 
                success: false,
                message: 'Accès refusé: Réservé aux enseignants' 
            });
        }
        req.user = user;
        next();
    } catch (error) {
        console.error('Teacher check error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur serveur' 
        });
    }
};

// CORRECTED: Get teacher's students
router.get('/students', isTeacher, async (req, res) => {
    try {
        console.log('Teacher ID:', req.user._id);
        
        // Find courses taught by this teacher (using 'instructor' field, not 'teacher')
        const courses = await Course.find({ instructor: req.user._id });
        console.log('Found courses:', courses.length);
        
        if (!courses || courses.length === 0) {
            return res.json({
                success: true,
                students: [],
                message: 'Aucun cours trouvé pour cet enseignant'
            });
        }

        // Extract all student IDs from courses
        const allStudentIds = [];
        courses.forEach(course => {
            if (course.students && course.students.length > 0) {
                course.students.forEach(student => {
                    if (!allStudentIds.includes(student.studentId.toString())) {
                        allStudentIds.push(student.studentId);
                    }
                });
            }
        });

        console.log('Found student IDs:', allStudentIds.length);

        if (allStudentIds.length === 0) {
            return res.json({
                success: true,
                students: [],
                message: 'Aucun étudiant inscrit à vos cours'
            });
        }

        // Find students by their IDs
        const students = await User.find({
            _id: { $in: allStudentIds },
            role: 'student'
        }).select('firstName lastName email profilePhoto lastLogin');

        console.log('Found students:', students.length);

        // Format the response
        const formattedStudents = students.map(student => {
            // Find courses this student is enrolled in
            const studentCourses = courses.filter(course => 
                course.students.some(s => s.studentId.toString() === student._id.toString())
            );

            // Calculate average progress
            let totalProgress = 0;
            let progressCount = 0;
            
            studentCourses.forEach(course => {
                const studentEnrollment = course.students.find(s => 
                    s.studentId.toString() === student._id.toString()
                );
                if (studentEnrollment && studentEnrollment.progress !== undefined) {
                    totalProgress += studentEnrollment.progress;
                    progressCount++;
                }
            });

            const averageProgress = progressCount > 0 ? Math.round(totalProgress / progressCount) : 0;
            
            // Format last activity
            const lastActivity = student.lastLogin 
                ? new Date(student.lastLogin).toLocaleString('fr-FR') 
                : 'Jamais connecté';
            
            return {
                id: student._id,
                name: `${student.firstName} ${student.lastName}`,
                email: student.email,
                profilePhoto: student.profilePhoto || '/assets/images/default-profile.png',
                courses: studentCourses.map(course => course.title),
                performance: averageProgress,
                lastActivity: lastActivity,
                status: 'Actif'
            };
        });

        res.json({
            success: true,
            students: formattedStudents
        });
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
});

// CORRECTED: Export students list
router.get('/students/export', isTeacher, async (req, res) => {
    try {
        // Find courses taught by this teacher (using 'instructor' field)
        const courses = await Course.find({ instructor: req.user._id });
        
        if (!courses || courses.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Aucun cours trouvé pour cet enseignant' 
            });
        }

        // Extract all student IDs from courses
        const allStudentIds = [];
        courses.forEach(course => {
            if (course.students && course.students.length > 0) {
                course.students.forEach(student => {
                    if (!allStudentIds.includes(student.studentId.toString())) {
                        allStudentIds.push(student.studentId);
                    }
                });
            }
        });

        if (allStudentIds.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Aucun étudiant inscrit à vos cours' 
            });
        }

        // Find students by their IDs
        const students = await User.find({
            _id: { $in: allStudentIds },
            role: 'student'
        }).select('firstName lastName email phone');

        // Prepare data for CSV
        const dataForExport = students.map(student => {
            // Find courses this student is enrolled in
            const studentCourses = courses.filter(course => 
                course.students.some(s => s.studentId.toString() === student._id.toString())
            );

            return {
                'Prénom': student.firstName,
                'Nom': student.lastName,
                'Email': student.email,
                'Téléphone': student.phone || 'Non renseigné',
                'Cours': studentCourses.map(course => course.title).join(', '),
                'Date d\'export': new Date().toLocaleDateString('fr-FR')
            };
        });

        // Convert to CSV
        const json2csvParser = new Parser();
        const csv = json2csvParser.parse(dataForExport);

        // Set headers for file download
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=etudiants.csv');

        // Send the CSV file with BOM for proper UTF-8 encoding
        res.send('\ufeff' + csv);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur lors de l\'export',
            error: error.message
        });
    }
});

// Get teacher dashboard statistics
router.get('/dashboard/stats', isTeacher, getDashboardStats);

// Get teacher profile
router.get('/profile', isTeacher, getProfile);

// Update teacher profile - FIXED VERSION
router.put('/profile', isTeacher, async (req, res) => {
    try {
        console.log('PUT /profile - Request body:', req.body);
        console.log('Teacher ID:', req.user._id);
        
        const { firstName, lastName, phone, birthDate } = req.body;
        
        // Validate required fields
        if (!firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'Le prénom et le nom sont obligatoires'
            });
        }

        // Prepare update data
        const updateData = {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone ? phone.trim() : '',
            updatedAt: new Date()
        };

        // Handle birthDate - only update if provided
        if (birthDate && birthDate.trim()) {
            updateData.birthDate = new Date(birthDate);
        }

        console.log('Update data:', updateData);
        
        const updatedTeacher = await User.findByIdAndUpdate(
            req.user._id,
            { $set: updateData },
            { 
                new: true, 
                runValidators: true,
                select: '-password -__v'
            }
        );

        if (!updatedTeacher) {
            return res.status(404).json({
                success: false,
                message: 'Enseignant non trouvé'
            });
        }

        console.log('Teacher updated successfully:', updatedTeacher);

        res.json({
            success: true,
            message: 'Profil mis à jour avec succès',
            teacher: {
                firstName: updatedTeacher.firstName,
                lastName: updatedTeacher.lastName,
                email: updatedTeacher.email,
                phone: updatedTeacher.phone,
                birthDate: updatedTeacher.birthDate,
                profilePhoto: updatedTeacher.profilePhoto
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const errors = {};
            Object.keys(error.errors).forEach(key => {
                errors[key] = error.errors[key].message;
            });
            return res.status(400).json({
                success: false,
                message: 'Erreur de validation',
                errors: errors
            });
        }
        
        res.status(500).json({ 
            success: false,
            message: 'Erreur serveur lors de la mise à jour',
            error: error.message
        });
    }
});

// Photo upload route - ENHANCED VERSION
router.post('/profile/photo', isTeacher, upload.single('profilePhoto'), async (req, res) => {
    try {
        console.log('POST /profile/photo - File:', req.file);
        console.log('Teacher ID:', req.user._id);
        
        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                message: 'Aucun fichier reçu' 
            });
        }

        // Construct the photo URL path
        const photoUrl = `/uploads/teachers/profile-photos/${req.file.filename}`;
        console.log('Photo URL:', photoUrl);
        
        // Update user profile with new photo
        const updatedTeacher = await User.findByIdAndUpdate(
            req.user._id,
            { 
                profilePhoto: photoUrl,
                updatedAt: new Date()
            },
            { new: true, select: '-password -__v' }
        );

        if (!updatedTeacher) {
            return res.status(404).json({
                success: false,
                message: 'Enseignant non trouvé'
            });
        }

        console.log('Profile photo updated successfully');

        res.json({
            success: true,
            photoUrl: photoUrl,
            message: 'Photo uploadée avec succès'
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur lors de l\'upload: ' + error.message
        });
    }
});

// Add authentication check route if it doesn't exist
router.get('/auth/check', async (req, res) => {
    try {
        if (!req.session.user?._id) {
            return res.status(401).json({ 
                success: false,
                message: 'Non authentifié' 
            });
        }

        const user = await User.findById(req.session.user._id);
        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: 'Utilisateur non trouvé' 
            });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName
            }
        });
    } catch (error) {
        console.error('Auth check error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur serveur' 
        });
    }
});

// =========================
//        COURSES API
// =========================

// List courses taught by the logged-in teacher
router.get('/courses', isTeacher, async (req, res) => {
    console.log(`--- [profRoutes.js] GET /courses route hit at ${new Date().toLocaleTimeString()} ---`);
    try {
        const courses = await Course.find({ instructor: req.user._id })
            .select('_id title description createdAt')
            .lean();
        res.json({ success: true, courses });
    } catch (err) {
        console.error('Teacher courses error:', err);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// NEW: Get count of courses taught by the logged-in teacher
router.get('/courses/count', isTeacher, async (req, res) => {
    try {
        const count = await Course.countDocuments({ instructor: req.user._id });
        res.json({ success: true, count });
    } catch (err) {
        console.error('Teacher courses count error:', err);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// =========================
//        QUIZZES API
// =========================

// List quizzes created by the logged-in teacher
router.get('/quizzes', isTeacher, async (req, res) => {
    console.log(`--- [profRoutes.js] GET /quizzes route hit at ${new Date().toLocaleTimeString()} ---`);
    try {
        const quizzes = await Quiz.find({ instructor: req.user._id }).sort({ createdAt: -1 }).lean();
        res.json({ success: true, quizzes });
    } catch (err) {
        console.error('List quizzes error:', err);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Create a new quiz
router.post('/quizzes', isTeacher, async (req, res) => {
    try {
        const { title, description, courseId, duration, points } = req.body;
        if (!title || !courseId) {
            return res.status(400).json({ success: false, message: 'Titre et cours requis' });
        }
        const quiz = await Quiz.create({
            title,
            description,
            course: courseId,
            instructor: req.user._id,
            duration: duration || 30,
            points: points || 0,
            status: 'draft'
        });
        res.json({ success: true, quiz });
    } catch (err) {
        console.error('Create quiz error:', err);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Get a single quiz (with populated questions)
// profRoutes.js
// Update the route to get a single quiz
router.get('/quiz/:id', isTeacher, async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id)
            .populate({
                path: 'questions',
                select: 'questionText type options correctAnswer explanation points' // FIX: Include all fields
            })
            .lean();
            
        if (!quiz) return res.status(404).json({ success: false, message: 'Quiz non trouvé' });
        res.json({ success: true, quiz });
    } catch (err) {
        console.error('Get quiz error:', err);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Add a question to a quiz
router.post('/quiz/:quizId/question', isTeacher, async (req, res) => {
    try {
        console.log('Received question data:', JSON.stringify(req.body, null, 2));
        
        const { quizId } = req.params;
        const { questionText, type, correctAnswer, options, explanation, points } = req.body;

        console.log('Question type:', type);
        console.log('Correct answer:', correctAnswer);
        console.log('Options:', options);

        const quiz = await Quiz.findOne({ _id: quizId, instructor: req.user._id });
        if (!quiz) {
            console.error('Quiz not found or unauthorized access:', { quizId, userId: req.user._id });
            return res.status(404).json({ success: false, message: 'Quiz non trouvé ou accès non autorisé.' });
        }

        const questionData = {
            quiz: quizId,
            questionText: questionText?.trim(),
            type,
            explanation: explanation?.trim(),
            points: parseInt(points) || 1
        };

        console.log('Processing question data:', { type, correctAnswer });

        if (type === 'multiple_choice') {
            console.log('Processing multiple choice question');
            console.log('Options received:', options);
            
            // Ensure options is an array and has at least 2 items
            if (!Array.isArray(options) || options.length < 2) {
                console.error('Not enough options provided:', options);
                return res.status(400).json({ 
                    success: false, 
                    message: 'Les questions à choix multiples doivent avoir au moins 2 options.' 
                });
            }
            
            // Ensure at least one option is marked as correct
            const hasCorrectAnswer = options.some(option => option.isCorrect === true || option.isCorrect === 'true');
            if (!hasCorrectAnswer) {
                console.error('No correct answer selected in options:', options);
                return res.status(400).json({ 
                    success: false, 
                    message: 'Veuillez sélectionner une réponse correcte.' 
                });
            }
            
            // Process options to ensure proper format
            questionData.options = options.map(option => ({
                text: String(option.text || '').trim(),
                isCorrect: option.isCorrect === true || option.isCorrect === 'true'
            }));
            
            // Validate that all options have text
            if (questionData.options.some(opt => !opt.text)) {
                console.error('One or more options are empty:', questionData.options);
                return res.status(400).json({ 
                    success: false, 
                    message: 'Toutes les options doivent avoir un texte.' 
                });
            }
        } else if (type === 'true_false') {
            console.log('Processing true/false question');
            if (correctAnswer === undefined || correctAnswer === null) {
                console.error('Missing true/false answer');
                return res.status(400).json({ 
                    success: false, 
                    message: 'La réponse pour une question vrai/faux est requise.' 
                });
            }
            // Convert string 'true'/'false' to boolean
            questionData.correctAnswer = correctAnswer === true || correctAnswer === 'true';
        } else if (type === 'open_ended') {
            console.log('Processing open-ended question');
            if (!correctAnswer || typeof correctAnswer !== 'string' || !correctAnswer.trim()) {
                console.error('Empty or invalid open-ended answer:', correctAnswer);
                return res.status(400).json({ 
                    success: false, 
                    message: 'La réponse pour une question ouverte ne peut pas être vide.' 
                });
            }
            // Ensure correctAnswer is a non-empty string
            questionData.correctAnswer = String(correctAnswer).trim();
        } else {
            console.error('Invalid question type:', type);
            return res.status(400).json({ 
                success: false, 
                message: 'Type de question non valide. Les types valides sont: multiple_choice, true_false, open_ended.' 
            });
        }

        console.log('Creating new question with data:', questionData);
        
        const newQuestion = new Question(questionData);
        
        // Validate the document before saving
        const validationError = newQuestion.validateSync();
        if (validationError) {
            console.error('Validation error:', validationError);
            const errors = {};
            Object.keys(validationError.errors).forEach(key => {
                errors[key] = validationError.errors[key].message;
            });
            return res.status(400).json({ 
                success: false, 
                message: 'Erreur de validation', 
                errors: errors,
                validationError: validationError.message
            });
        }
        
        await newQuestion.save();
        console.log('Question saved successfully:', newQuestion);

        quiz.questions.push(newQuestion._id);
        await quiz.save();

        res.status(201).json({ 
            success: true, 
            message: 'Question ajoutée avec succès', 
            question: newQuestion 
        });
    } catch (err) {
        console.error('Add question error:', err);
        if (err.name === 'ValidationError') {
            const errors = {};
            Object.keys(err.errors).forEach(key => {
                errors[key] = err.errors[key].message;
            });
            return res.status(400).json({ 
                success: false, 
                message: 'Erreur de validation', 
                errors: errors,
                validationError: err.message
            });
        }
        res.status(500).json({ 
            success: false, 
            message: 'Erreur serveur',
            error: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// GET a single question for editing
router.get('/questions/:id', isTeacher, async (req, res) => {
    try {
        console.log('Fetching question with ID:', req.params.id);
        
        if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            console.error('Invalid question ID format:', req.params.id);
            return res.status(400).json({ 
                success: false, 
                message: 'Format d\'ID de question invalide' 
            });
        }

        const question = await Question.findById(req.params.id);

        if (!question) {
            console.error('Question not found:', req.params.id);
            return res.status(404).json({ 
                success: false, 
                message: 'Question non trouvée' 
            });
        }

        // Security check: ensure the teacher owns the quiz this question belongs to
        const quiz = await Quiz.findById(question.quiz);
        if (!quiz || quiz.instructor.toString() !== req.user._id.toString()) {
            console.error('Unauthorized access attempt:', { 
                userId: req.user._id,
                quizInstructor: quiz?.instructor,
                questionId: req.params.id
            });
            return res.status(403).json({ 
                success: false, 
                message: 'Accès non autorisé à cette question' 
            });
        }

        console.log('Question found, sending response');
        res.json({ 
            success: true, 
            question: {
                _id: question._id,
                questionText: question.questionText,
                type: question.type,
                options: question.options,
                correctAnswer: question.correctAnswer,
                explanation: question.explanation,
                points: question.points,
                quiz: question.quiz
            } 
        });
    } catch (error) {
        console.error('Get question error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de la récupération de la question',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Update question
router.put('/questions/:id', isTeacher, async (req, res) => {
    try {
        const { questionText, type, correctAnswer, options, explanation, points } = req.body;
        const questionId = req.params.id;

        console.log('Updating question:', { questionId, type, questionText });

        // Vérifier l'accès
        const originalQuestion = await Question.findById(questionId);
        if (!originalQuestion) {
            return res.status(404).json({ 
                success: false, 
                message: 'Question non trouvée' 
            });
        }
        
        const quiz = await Quiz.findById(originalQuestion.quiz);
        if (!quiz || quiz.instructor.toString() !== req.user._id.toString()) {
            console.error('Unauthorized access:', { 
                userId: req.user._id,
                quizInstructor: quiz?.instructor,
                questionId: questionId
            });
            return res.status(403).json({ 
                success: false, 
                message: 'Accès non autorisé' 
            });
        }

        // Validate required fields
        if (!questionText || !type) {
            console.error('Missing required fields:', { questionText, type });
            return res.status(400).json({
                success: false,
                message: 'Le texte de la question et le type sont obligatoires'
            });
        }

        // Préparer les données de mise à jour
        const updateData = {
            questionText: questionText.trim(),
            type,
            explanation: explanation ? explanation.trim() : '',
            points: parseInt(points) || 1,
            updatedAt: Date.now()
        };

        // Gestion par type de question
        if (type === 'multiple_choice') {
            if (!options || !Array.isArray(options) || options.length < 2) {
                console.error('Invalid options:', options);
                return res.status(400).json({ 
                    success: false, 
                    message: 'Au moins 2 options sont requises' 
                });
            }
            
            // Validate that at least one option is marked as correct
            const hasCorrectAnswer = options.some(opt => opt.isCorrect);
            if (!hasCorrectAnswer) {
                console.error('No correct answer:', options);
                return res.status(400).json({
                    success: false,
                    message: 'Au moins une option doit être marquée comme correcte'
                });
            }

            updateData.options = options.map(opt => ({
                text: opt.text.trim(),
                isCorrect: Boolean(opt.isCorrect)
            }));
            updateData.correctAnswer = undefined; // Clear correctAnswer for MCQs
            
        } else if (type === 'true_false') {
            if (typeof correctAnswer !== 'boolean') {
                console.error('Invalid correct answer:', correctAnswer);
                return res.status(400).json({ 
                    success: false, 
                    message: 'Réponse Vrai/Faux invalide' 
                });
            }
            updateData.correctAnswer = correctAnswer;
            updateData.options = [];
            
        } else if (type === 'open_ended') {
            if (!correctAnswer || typeof correctAnswer !== 'string') {
                console.error('Invalid correct answer:', correctAnswer);
                return res.status(400).json({ 
                    success: false, 
                    message: 'Réponse ouverte invalide' 
                });
            }
            updateData.correctAnswer = correctAnswer.trim();
            updateData.options = [];
            
        } else {
            console.error('Invalid question type:', type);
            return res.status(400).json({
                success: false,
                message: 'Type de question non valide. Types acceptés: multiple_choice, true_false, open_ended'
            });
        }

        console.log('Updating question with data:', updateData);

        // Mise à jour
        const updatedQuestion = await Question.findByIdAndUpdate(
            questionId,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedQuestion) {
            console.error('Failed to update question:', questionId);
            throw new Error('Échec de la mise à jour de la question');
        }

        console.log('Question updated successfully:', updatedQuestion._id);
        
        res.json({ 
            success: true, 
            message: 'Question mise à jour avec succès', 
            question: updatedQuestion 
        });
        
    } catch (err) {
        console.error('Update question error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de la mise à jour de la question',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Delete question
router.delete('/question/:id', isTeacher, async (req, res) => {
    try {
        const question = await Question.findByIdAndDelete(req.params.id);
        if (!question) return res.status(404).json({ success: false, message: 'Question non trouvée' });
        // Remove ref from quiz
        await Quiz.updateOne({ _id: question.quiz }, { $pull: { questions: question._id } });
        res.json({ success: true });
    } catch (err) {
        console.error('Delete question error:', err);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Publish quiz (set status to published)
router.put('/quiz/:id/publish', isTeacher, async (req, res) => {
    try {
        const quiz = await Quiz.findOneAndUpdate(
            { _id: req.params.id, instructor: req.user._id },
            { status: 'published' },
            { new: true }
        );
        if (!quiz) return res.status(404).json({ success: false, message: 'Quiz non trouvé' });
        res.json({ success: true, quiz });
    } catch (err) {
        console.error('Publish quiz error:', err);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Delete quiz
router.delete('/quiz/:id', isTeacher, async (req, res) => {
    try {
        const quiz = await Quiz.findOneAndDelete({ _id: req.params.id, instructor: req.user._id });
        if (!quiz) return res.status(404).json({ success: false, message: 'Quiz non trouvé' });
        // Also delete its questions
        await Question.deleteMany({ quiz: quiz._id });
        res.json({ success: true });
    } catch (err) {
        console.error('Delete quiz error:', err);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Add a new assignment (devoir) to a course
router.post('/courses/:courseId/devoirs', isTeacher, devoirUpload.single('pdf'), async (req, res) => {
    try {
        const { courseId } = req.params;
        const { title, description } = req.body;
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Le fichier PDF est requis.' });
        }
        // Check course ownership
        const course = await Course.findOne({ _id: courseId, instructor: req.user._id });
        if (!course) {
            return res.status(403).json({ success: false, message: 'Accès refusé à ce cours.' });
        }
        const devoir = await Devoir.create({
            title,
            description,
            course: courseId,
            professor: req.user._id,
            fileUrl: `/uploads/devoirs/${req.file.filename}`
        });
        res.json({ success: true, devoir });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// List all assignments for a course
router.get('/courses/:courseId/devoirs', isTeacher, async (req, res) => {
    try {
        const { courseId } = req.params;
        // Check course ownership
        const course = await Course.findOne({ _id: courseId, instructor: req.user._id });
        if (!course) {
            return res.status(403).json({ success: false, message: 'Accès refusé à ce cours.' });
        }
        const devoirs = await Devoir.find({ course: courseId }).sort({ createdAt: -1 });
        res.json({ success: true, devoirs });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Edit an assignment (title, description, replace PDF)
router.put('/devoirs/:devoirId', isTeacher, devoirUpload.single('pdf'), async (req, res) => {
    try {
        const { devoirId } = req.params;
        const { title, description } = req.body;
        const devoir = await Devoir.findById(devoirId);
        if (!devoir) {
            return res.status(404).json({ success: false, message: 'Devoir non trouvé.' });
        }
        // Check ownership
        const course = await Course.findOne({ _id: devoir.course, instructor: req.user._id });
        if (!course) {
            return res.status(403).json({ success: false, message: 'Accès refusé à ce devoir.' });
        }
        // If replacing PDF, delete old file
        if (req.file) {
            if (devoir.fileUrl) {
                const oldPath = path.join(__dirname, '..', devoir.fileUrl);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            devoir.fileUrl = `/uploads/devoirs/${req.file.filename}`;
        }
        if (title) devoir.title = title;
        if (description) devoir.description = description;
        await devoir.save();
        res.json({ success: true, devoir });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Delete an assignment
router.delete('/devoirs/:devoirId', isTeacher, async (req, res) => {
    try {
        const { devoirId } = req.params;
        const devoir = await Devoir.findById(devoirId);
        if (!devoir) {
            return res.status(404).json({ success: false, message: 'Devoir non trouvé.' });
        }
        // Check ownership
        const course = await Course.findOne({ _id: devoir.course, instructor: req.user._id });
        if (!course) {
            return res.status(403).json({ success: false, message: 'Accès refusé à ce devoir.' });
        }
        // Delete PDF file
        if (devoir.fileUrl) {
            const filePath = path.join(__dirname, '..', devoir.fileUrl);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        await devoir.deleteOne();
        res.json({ success: true, message: 'Devoir supprimé.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Get a single devoir by ID
router.get('/devoirs/:devoirId', isTeacher, async (req, res) => {
    try {
        const devoir = await Devoir.findById(req.params.devoirId);
        if (!devoir) {
            return res.status(404).json({ success: false, message: 'Devoir non trouvé.' });
        }
        // Check ownership
        const course = await Course.findOne({ _id: devoir.course, instructor: req.user._id });
        if (!course) {
            return res.status(403).json({ success: false, message: 'Accès refusé à ce devoir.' });
        }
        res.json({ success: true, devoir });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Get all submissions for a specific devoir (prof only)
router.get('/devoirs/:devoirId/submissions', isTeacher, async (req, res) => {
    try {
        const devoir = await Devoir.findById(req.params.devoirId);
        if (!devoir) {
            return res.status(404).json({ success: false, message: 'Devoir non trouvé.' });
        }
        // Check ownership
        const course = await Course.findOne({ _id: devoir.course, instructor: req.user._id });
        if (!course) {
            return res.status(403).json({ success: false, message: 'Accès refusé à ce devoir.' });
        }
        const DevoirSubmission = require('../models/DevoirSubmission');
        const submissions = await DevoirSubmission.find({ devoir: devoir._id })
            .populate('student', 'firstName lastName email');
        res.json({ success: true, submissions });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

module.exports = router;