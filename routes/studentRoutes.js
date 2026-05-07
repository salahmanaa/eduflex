const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const User = require('../models/User');
const Course = require('../models/Course');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt'); // You'll need to create this model
const fs = require('fs');
const { startQuizAttempt } = require('../controllers/quizController');
const Devoir = require('../models/Devoir');
const DevoirSubmission = require('../models/DevoirSubmission');
const { getDashboardStats, getProfile } = require('../controllers/studentController');

// Create upload directory if it doesn't exist
const uploadDir = 'public/uploads/students/profile-photos/';
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
        cb(null, `student-${req.user._id}-${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Directory for student devoir submissions
const devoirSubmissionDir = 'public/uploads/students/devoirs/';
if (!fs.existsSync(devoirSubmissionDir)) {
    fs.mkdirSync(devoirSubmissionDir, { recursive: true });
}

const devoirStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, devoirSubmissionDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `devoir-${req.user._id}-${Date.now()}${ext}`);
    }
});
const devoirUpload = multer({
    storage: devoirStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Seuls les fichiers PDF sont autorisés !'), false);
        }
    }
});

// Middleware to check if user is a student
const isStudent = async (req, res, next) => {
  try {
    const user = await User.findById(req.session.user?._id);
    if (!user || user.role !== 'student') {
      return res.status(403).json({ message: 'Accès refusé: Réservé aux étudiants' });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error('Student check error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Get student dashboard statistics
router.get('/dashboard/stats', isStudent, getDashboardStats);

// Get student profile
router.get('/profile', isStudent, getProfile);

// Update student profile
router.put('/profile', isStudent, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, birthDate } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ message: 'Prénom, nom et email sont obligatoires' });
    }

    const updatedStudent = await User.findByIdAndUpdate(
      req.user._id,
      { 
        firstName, 
        lastName, 
        email, 
        phone, 
        birthDate: birthDate || null 
      },
      { 
        new: true, 
        runValidators: true 
      }
    ).select('-password -__v');

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès',
      student: updatedStudent
    });
  } catch (error) {
    console.error('Update error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Erreur de validation',
        errors: error.errors 
      });
    }
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Photo upload route
router.post('/profile/photo', isStudent, upload.single('profilePhoto'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Aucun fichier téléchargé' });
        }

        const photoUrl = `/uploads/students/profile-photos/${req.file.filename}`;
        
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { profilePhoto: photoUrl },
            { new: true }
        ).select('profilePhoto');

        res.json({
            success: true,
            photoUrl: photoUrl,
            message: 'Photo téléchargée avec succès'
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Échec du téléchargement: ' + error.message
        });
    }
});

// Get student dashboard data with enrolled courses
router.get('/dashboard', isStudent, async (req, res) => {
  try {
    console.log('Getting dashboard data for student:', req.user._id);
    
    // Find courses where this student is enrolled
    const enrolledCourses = await Course.find({ 
      'students.studentId': req.user._id 
    }).select('title description instructor students');

    // Get student info
    const student = await User.findById(req.user._id)
      .select('firstName lastName profilePhoto');

    // Get recent quiz attempts
    const recentAttempts = await QuizAttempt.find({ student: req.user._id })
      .populate('quiz', 'title')
      .populate('course', 'title')
      .sort({ createdAt: -1 })
      .limit(5);

    // Calculate student's progress in each course
    const coursesWithProgress = enrolledCourses.map(course => {
      const studentEnrollment = course.students.find(
        s => s.studentId.toString() === req.user._id.toString()
      );
      
      return {
        _id: course._id,
        title: course.title,
        description: course.description,
        instructor: course.instructor,
        progress: studentEnrollment ? studentEnrollment.progress || 0 : 0,
        enrolledAt: studentEnrollment ? studentEnrollment.enrolledAt : null
      };
    });

    // Calculate dashboard statistics
    const totalAttempts = await QuizAttempt.countDocuments({ student: req.user._id });
    const completedAttempts = await QuizAttempt.countDocuments({ 
      student: req.user._id, 
      status: 'completed' 
    });
    const averageScore = await QuizAttempt.aggregate([
      { $match: { student: req.user._id, status: 'completed' } },
      { $group: { _id: null, avgScore: { $avg: '$score' } } }
    ]);

    res.json({
      success: true,
      student: {
        ...student.toObject(),
        courses: coursesWithProgress
      },
      statistics: {
        totalCourses: coursesWithProgress.length,
        totalQuizAttempts: totalAttempts,
        completedQuizzes: completedAttempts,
        averageScore: averageScore.length > 0 ? Math.round(averageScore[0].avgScore) : 0
      },
      recentAttempts: recentAttempts.map(attempt => ({
        _id: attempt._id,
        quiz: attempt.quiz,
        course: attempt.course,
        score: attempt.score,
        status: attempt.status,
        createdAt: attempt.createdAt
      }))
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur' 
    });
  }
});

// =========================
//     COURSES & QUIZZES
// =========================

// Get courses that the student is enrolled in
router.get('/courses', isStudent, async (req, res) => {
  try {
    console.log('Getting courses for student:', req.user._id);
    
    const courses = await Course.find({ 
      'students.studentId': req.user._id 
    }).populate('instructor', 'firstName lastName')
      .select('title description instructor students createdAt');

    // Format courses with student's progress
    const formattedCourses = courses.map(course => {
      const studentEnrollment = course.students.find(
        s => s.studentId.toString() === req.user._id.toString()
      );
      
      return {
        _id: course._id,
        title: course.title,
        description: course.description,
        instructor: course.instructor,
        progress: studentEnrollment ? studentEnrollment.progress || 0 : 0,
        enrolledAt: studentEnrollment ? studentEnrollment.enrolledAt : null,
        createdAt: course.createdAt
      };
    });

    res.json({
      success: true,
      courses: formattedCourses
    });
  } catch (error) {
    console.error('Get student courses error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur' 
    });
  }
});

// Get available quizzes for student
router.get('/quizzes', isStudent, async (req, res) => {
    try {
        const searchQuery = req.query.q || '';
        const user = req.user;

        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Utilisateur non authentifié' 
            });
        }

        // Get enrolled courses
        const enrolledCourses = await Course.find({ 'students.studentId': user._id });
        if (!enrolledCourses || enrolledCourses.length === 0) {
            return res.json({ 
                success: true, 
                quizzes: [] 
            });
        }

        // Build query
        const query = {
            course: { $in: enrolledCourses.map(c => c._id) },
            status: 'published', // Use the correct status field
            $and: [
                { startDate: { $lte: new Date() } }, // Quiz has started
                { $or: [
                    { endDate: { $gte: new Date() } }, // Quiz hasn't ended
                    { endDate: { $exists: false } } // No end date set
                ]}
            ]
        };

        // Add search query if present
        if (searchQuery) {
            query.$or = [
                { title: { $regex: searchQuery, $options: 'i' } },
                { description: { $regex: searchQuery, $options: 'i' } }
            ];
        }

        const quizzes = await Quiz.find(query)
            .populate('course', 'name')
            .select('-questions.correctAnswers')
            .lean();

        if (!quizzes) {
            return res.json({ 
                success: true, 
                quizzes: [] 
            });
        }

        const quizAttempts = await QuizAttempt.find({
            student: user._id,
            quiz: { $in: quizzes.map(q => q._id) }
        });

        const quizzesWithAttempts = quizzes.map(quiz => {
            const attempts = quizAttempts.filter(a => a.quiz.equals(quiz._id));
            const completedAttempts = attempts.filter(a => a.completed);
            const inProgressAttempt = attempts.find(a => !a.completed);
            
            return {
                ...quiz,
                attemptStatus: inProgressAttempt ? 'in_progress' : 
                          completedAttempts.length > 0 ? 'completed' : 'not_started',
                score: completedAttempts.length > 0 ? 
                      Math.max(...completedAttempts.map(a => a.score)) : null,
                maxAttempts: quiz.maxAttempts || 1,
                attemptsCount: attempts.length,
                canRetake: !quiz.maxAttempts || attempts.length < quiz.maxAttempts
            };
        });

        res.json({ 
            success: true, 
            quizzes: quizzesWithAttempts 
        });
    } catch (error) {
        console.error('Error fetching quizzes:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur serveur',
            error: error.message 
        });
    }
});

// Check for active quiz attempt
router.get('/quiz/active', isStudent, async (req, res) => {
  try {
    const now = new Date();
    const activeAttempt = await QuizAttempt.findOne({
      student: req.user._id,
      completed: false,
      endTime: { $gt: now }
    })
    .populate({
      path: 'quiz',
      select: 'title timeLimit questions',
      populate: {
        path: 'course',
        select: 'name'
      }
    })
    .lean();

    if (!activeAttempt) {
      return res.json({ active: false });
    }

    const timeRemaining = Math.ceil((new Date(activeAttempt.endTime) - now) / 1000);

    res.json({
      active: true,
      quiz: {
        _id: activeAttempt.quiz._id,
        title: activeAttempt.quiz.title,
        timeLimit: activeAttempt.quiz.timeLimit,
        course: activeAttempt.quiz.course,
        questions: activeAttempt.quiz.questions.map(q => ({
          _id: q._id,
          text: q.text,
          type: q.type,
          options: q.options,
          points: q.points
        }))
      },
      attempt: {
        _id: activeAttempt._id,
        startTime: activeAttempt.startTime,
        endTime: activeAttempt.endTime,
        timeRemaining
      }
    });
  } catch (error) {
    console.error('Error checking active quiz:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
});

// Start a quiz attempt
router.post('/quiz/:quizId/start', isStudent, startQuizAttempt);

// Submit quiz attempt
router.post('/quiz-attempt/:attemptId/submit', isStudent, async (req, res) => {
    try {
        const { attemptId } = req.params;
        console.log('Submitting quiz attempt:', attemptId);
        console.log('REQ BODY:', req.body);

        const attempt = await QuizAttempt.findOne({
          _id: attemptId,
          student: req.user._id
        }).populate({
          path: 'quiz',
          populate: {
            path: 'questions'
          }
        });

        if (!attempt) {
          return res.status(404).json({
            success: false,
            message: 'Tentative non trouvée'
          });
        }

        if (attempt.status !== 'in_progress') {
          return res.status(400).json({
            success: false,
            message: 'Cette tentative a déjà été soumise'
          });
        }

        // Normalize answers from frontend
        if (Array.isArray(req.body.answers)) {
          // Overwrite attempt.answers with normalized answers
          attempt.answers = req.body.answers.map(ans => {
            let answerValue = null;
            if (ans.selectedOptions !== undefined) {
              if (Array.isArray(ans.selectedOptions)) {
                // Checkbox or MCQ
                answerValue = ans.selectedOptions.length === 1 ? ans.selectedOptions[0] : ans.selectedOptions;
              }
            } else if (ans.textAnswer !== undefined) {
              answerValue = ans.textAnswer;
            }
            return {
              questionId: ans.questionId,
              answer: answerValue,
              timeSpent: ans.timeSpent || 0,
              answeredAt: new Date()
            };
          });
          await attempt.save();
        }

        let totalScore = 0;
        let maxScore = 0;
        let correctCount = 0;
        const detailedResults = [];

        // Grading logic
        for (const question of attempt.quiz.questions) {
          maxScore += question.points;
          const studentAnswer = attempt.answers.find(
            a => a.questionId.toString() === question._id.toString()
          );
          let isCorrect = false;
          let earnedPoints = 0;
          let studentAnswerText = '';
          let correctAnswerText = '';

          if (studentAnswer) {
            // MULTIPLE CHOICE
            if (question.type === 'multiple_choice') {
              let selectedOption = null;
              if (typeof studentAnswer.answer === 'number') {
                selectedOption = question.options[studentAnswer.answer];
                studentAnswerText = selectedOption ? selectedOption.text : '';
              } else {
                selectedOption = question.options.find(opt => opt._id.toString() === studentAnswer.answer?.toString());
                studentAnswerText = selectedOption ? selectedOption.text : '';
              }
              isCorrect = selectedOption && selectedOption.isCorrect;
              correctAnswerText = question.options.filter(opt => opt.isCorrect).map(opt => opt.text).join(', ');
            }
            // TRUE/FALSE
            else if (question.type === 'true_false') {
              const correct = (question.correctAnswer === true || question.correctAnswer === 'true' || question.correctAnswer === 1 || question.correctAnswer === '1');
              const student = (studentAnswer.answer === true || studentAnswer.answer === 'true' || studentAnswer.answer === 1 || studentAnswer.answer === '1');
              isCorrect = correct === student;
              studentAnswerText = String(studentAnswer.answer);
              correctAnswerText = String(question.correctAnswer);
            }
            // CHECKBOX
            else if (question.type === 'checkbox') {
              let selectedOptionIds = [];
              if (Array.isArray(studentAnswer.answer) && typeof studentAnswer.answer[0] === 'number') {
                selectedOptionIds = studentAnswer.answer.map(idx => question.options[idx]?._id?.toString());
                studentAnswerText = studentAnswer.answer.map(idx => question.options[idx]?.text).filter(Boolean).join(', ');
              } else {
                selectedOptionIds = Array.isArray(studentAnswer.answer) ? studentAnswer.answer.map(a => a.toString()) : [];
                studentAnswerText = selectedOptionIds.map(id => {
                  const opt = question.options.find(o => o._id.toString() === id);
                  return opt ? opt.text : '';
                }).filter(Boolean).join(', ');
              }
              const correctOptionIds = question.options.filter(opt => opt.isCorrect).map(opt => opt._id.toString());
              correctAnswerText = question.options.filter(opt => opt.isCorrect).map(opt => opt.text).join(', ');
              isCorrect = correctOptionIds.length === selectedOptionIds.length &&
                correctOptionIds.every(id => selectedOptionIds.includes(id));
            }
            // SHORT/OPEN ENDED
            else if (question.type === 'open_ended' || question.type === 'short_answer') {
              let correctAnswers = [];
              if (Array.isArray(question.correctAnswer)) {
                correctAnswers = question.correctAnswer;
              } else if (Array.isArray(question.correctAnswers)) {
                correctAnswers = question.correctAnswers;
              } else if (typeof question.correctAnswer === 'string') {
                correctAnswers = [question.correctAnswer];
              }
              isCorrect = correctAnswers.some(ca =>
                ca && studentAnswer.answer && ca.trim().toLowerCase() === studentAnswer.answer.trim().toLowerCase()
              );
              studentAnswerText = studentAnswer.answer || '';
              correctAnswerText = correctAnswers.join(', ');
            }
            if (isCorrect) {
              earnedPoints = question.points;
              totalScore += earnedPoints;
              correctCount++;
            }
          }
          detailedResults.push({
            questionId: question._id,
            questionText: question.questionText,
            type: question.type,
            points: question.points,
            earnedPoints,
            isCorrect,
            studentAnswer: studentAnswerText,
            correctAnswer: correctAnswerText,
            explanation: question.explanation
          });
        }

        const percentageScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

        attempt.status = 'completed';
        attempt.score = percentageScore;
        attempt.totalPoints = totalScore;
        attempt.maxPoints = maxScore;
        attempt.completedAt = new Date();
        attempt.detailedResults = detailedResults;
        await attempt.save();

        res.json({
          success: true,
          message: 'Quiz soumis avec succès',
          results: {
            score: percentageScore,
            totalPoints: totalScore,
            maxPoints: maxScore,
            correctAnswers: correctCount,
            totalQuestions: detailedResults.length,
            passed: totalScore >= (maxScore / 2),
            completedAt: attempt.completedAt,
            timeSpent: Math.round((attempt.completedAt - attempt.startedAt) / 1000 / 60)
          },
          detailedResults: detailedResults
        });
    } catch (error) {
        console.error('Submit quiz error:', error);
        res.status(500).json({
          success: false,
          message: 'Erreur lors de la soumission du quiz'
        });
    }
});

// Get active quiz attempt
router.get('/quiz/active', isStudent, async (req, res) => {
    try {
        const now = new Date();
        
        // Find active (incomplete) quiz attempts that haven't expired
        const activeAttempt = await QuizAttempt.findOne({
            student: req.user._id,
            completed: false,
            endTime: { $gt: now }
        }).populate('quiz');

        if (!activeAttempt) {
            return res.json({ active: false });
        }

        // Get the quiz without exposing correct answers
        const quiz = await Quiz.findById(activeAttempt.quiz._id)
            .select('-questions.correctAnswers');

        res.json({
            active: true,
            attempt: activeAttempt,
            quiz: quiz
        });
    } catch (error) {
        console.error('Error checking active quiz:', error);
        res.status(500).json({ success: false, message: 'Error checking active quiz' });
    }
});

// Abandon quiz attempt
router.post('/quiz-attempt/:attemptId/abandon', isStudent, async (req, res) => {
    try {
        const { attemptId } = req.params;
        const attempt = await QuizAttempt.findById(attemptId);

        if (!attempt) {
            return res.status(404).json({ success: false, message: 'Attempt not found' });
        }

        // Verify ownership
        if (attempt.student.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        // Mark as abandoned
        attempt.status = 'abandoned';
        attempt.completed = true;
        attempt.completedAt = new Date();
        await attempt.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error abandoning quiz attempt:', error);
        res.status(500).json({ success: false, message: 'Error abandoning quiz attempt' });
    }
});

// Get quiz results
router.get('/quiz-attempt/:attemptId/results', isStudent, async (req, res) => {
    try {
        const { attemptId } = req.params;
        
        // Find the attempt
        const attempt = await QuizAttempt.findById(attemptId)
            .populate('quiz', 'title description passingScore')
            .populate('course', 'name');

        if (!attempt) {
            return res.status(404).json({ success: false, message: 'Attempt not found' });
        }

        // Verify ownership
        if (attempt.student.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        // Get the quiz with questions
        const quiz = await Quiz.findById(attempt.quiz._id);
        if (!quiz) {
            return res.status(404).json({ success: false, message: 'Quiz not found' });
        }

        // Prepare detailed results
        const details = [];
        let correctCount = 0;

        for (const question of quiz.questions) {
            const answer = attempt.answers.find(a => a.questionId.toString() === question._id.toString());
            const isCorrect = isAnswerCorrect(question, answer);
            
            if (isCorrect) correctCount++;

            details.push({
                questionId: question._id,
                question: question.text,
                type: question.type,
                userAnswer: formatUserAnswer(question, answer),
                correctAnswer: formatCorrectAnswer(question),
                isCorrect,
                explanation: question.explanation
            });
        }

        const results = {
            quizTitle: quiz.title,
            courseName: quiz.course?.name || 'No Course',
            score: correctCount,
            totalQuestions: quiz.questions.length,
            percentage: Math.round((correctCount / quiz.questions.length) * 100),
            passed: correctCount >= (quiz.passingScore || 0),
            passingScore: quiz.passingScore || 0,
            startTime: attempt.startTime,
            endTime: attempt.completedAt,
            timeSpent: attempt.timeSpent,
            details
        };

        res.json({ success: true, results });
    } catch (error) {
        console.error('Error getting quiz results:', error);
        res.status(500).json({ success: false, message: 'Error getting quiz results' });
    }
});

// Helper function to check if an answer is correct
function isAnswerCorrect(question, answer) {
    if (!answer) return false;

    // Robust answer checking
    const correctAnswers = question.correctAnswers || [];
    const submittedOptions = answer.selectedOptions || [];
    const submittedText = (answer.textAnswer || "").trim().toLowerCase();

    console.log('Grading:', {
        question: question.text,
        type: question.type,
        correctAnswers: correctAnswers,
        submittedOptions: submittedOptions,
        submittedText: submittedText
    });

    switch (question.type) {
        case 'multiple_choice':
        case 'true_false':
            if (submittedOptions.length !== 1) return false;
            // Check if submitted index is in correctAnswers
            return correctAnswers.includes(submittedOptions[0]);

        case 'checkbox':
            if (submittedOptions.length !== correctAnswers.length) return false;
            // Sort and compare to ensure order doesn't matter
            const sortedCorrect = [...correctAnswers].sort().toString();
            const sortedSubmitted = [...submittedOptions].sort().toString();
            return sortedCorrect === sortedSubmitted;

        case 'short_answer':
            if (!submittedText) return false;
            // Check if submitted text matches any of the correct answers (case-insensitive)
            return correctAnswers.some(ca => (ca || "").toLowerCase() === submittedText);

        default:
            return false;
    }
}

// Helper function to format user's answer for display
function formatUserAnswer(question, answer) {
    if (!answer) return 'No answer';

    switch (question.type) {
        case 'multiple_choice':
        case 'true_false':
            if (answer.selectedOptions && answer.selectedOptions.length > 0) {
                const optionIndex = answer.selectedOptions[0];
                return question.options[optionIndex] || 'Invalid option';
            }
            return 'No answer';
        
        case 'checkbox':
            if (answer.selectedOptions && answer.selectedOptions.length > 0) {
                return answer.selectedOptions
                    .map(opt => question.options[opt])
                    .filter(opt => opt !== undefined)
                    .join(', ');
            }
            return 'No answer';
        
        case 'short_answer':
            return answer.textAnswer || 'No answer';
        
        default:
            return 'Unknown answer type';
    }
}

// Helper function to format correct answer for display
function formatCorrectAnswer(question) {
    if (!question || !Array.isArray(question.correctAnswers) || question.correctAnswers.length === 0) {
        return 'N/A';
    }

    switch (question.type) {
        case 'multiple_choice':
        case 'true_false':
            // Map indices to option text
            return question.correctAnswers
                .map(index => question.options[index])
                .filter(Boolean) // Remove any undefined/null options
                .join(', ');
        
        case 'checkbox':
            // Map indices to option text
            return question.correctAnswers
                .map(index => question.options[index])
                .filter(Boolean)
                .join(', ');
        
        case 'short_answer':
            return question.correctAnswers.join(', ');
        
        default:
            return 'N/A';
    }
}

// =========================
//      QUIZ TAKING
// =========================

// Get active quiz attempt
router.get('/quiz/active', isStudent, async (req, res) => {
  try {
    const now = new Date();
    
    // Find active (incomplete) quiz attempts that haven't expired
    const activeAttempt = await QuizAttempt.findOne({
      student: req.user._id,
      completed: false,
      endTime: { $gt: now }
    }).populate('quiz');

    if (!activeAttempt) {
      return res.json({ active: false });
    }

    // Get the quiz without exposing correct answers
    const quiz = await Quiz.findById(activeAttempt.quiz._id)
      .select('-questions.correctAnswers');

    res.json({
      active: true,
      attempt: activeAttempt,
      quiz: quiz
    });
  } catch (error) {
    console.error('Error checking active quiz:', error);
    res.status(500).json({ success: false, message: 'Error checking active quiz' });
  }
});

// Start a new quiz attempt
router.post('/quiz/:id/start', isStudent, async (req, res) => {
  try {
    const quizId = req.params.id;
    console.log('Starting quiz attempt for student:', req.user._id, 'quiz:', quizId);

    // Find the quiz and populate questions
    const quiz = await Quiz.findById(quizId)
      .populate({
        path: 'questions',
        select: 'questionText type options explanation points'
      })
      .populate('course', 'title');

    if (!quiz) {
      return res.status(404).json({ 
        success: false,
        message: 'Quiz non trouvé' 
      });
    }

    // Check if student is enrolled in the course
    const course = await Course.findOne({
      _id: quiz.course._id,
      'students.studentId': req.user._id
    });

    if (!course) {
      return res.status(403).json({ 
        success: false,
        message: 'Vous n\'êtes pas inscrit à ce cours' 
      });
    }

    // Only allow published quizzes
    if (quiz.status !== 'published') {
      return res.status(403).json({ 
        success: false,
        message: 'Ce quiz n\'est pas encore disponible' 
      });
    }

    // Check if there's an active attempt
    const activeAttempt = await QuizAttempt.findOne({
      student: req.user._id,
      quiz: quizId,
      status: 'in_progress'
    });

    if (activeAttempt) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà une tentative en cours pour ce quiz',
        attemptId: activeAttempt._id
      });
    }

    // Create new quiz attempt
    const startTime = new Date();
    // Fallback chain for backward compatibility with old quiz data
    const timeLimit = quiz.timeLimit || quiz.duration || 30;
    const endTime = new Date(startTime.getTime() + (timeLimit * 60000));
    const totalQuestions = quiz.questions ? quiz.questions.length : 0;

    const newAttempt = new QuizAttempt({
      student: req.user._id,
      quiz: quizId,
      course: quiz.course._id,
      startedAt: startTime,
      expiresAt: endTime,
      status: 'in_progress',
      totalQuestions: totalQuestions || 0,
    });

    await newAttempt.save();

    // Format questions for student (remove correct answers)
    const formattedQuestions = quiz.questions.map((question, index) => {
      const questionData = {
        _id: question._id,
        questionNumber: index + 1,
        questionText: question.questionText,
        type: question.type,
        points: question.points
      };

      // For multiple choice, only send options without isCorrect flag
      if (question.type === 'multiple_choice' && question.options) {
        questionData.options = question.options.map(option => ({
          _id: option._id,
          text: option.text
        }));
      }

      return questionData;
    });

    res.json({
      success: true,
      message: 'Quiz commencé avec succès',
      attempt: {
        _id: newAttempt._id,
        startedAt: newAttempt.startedAt,
        expiresAt: newAttempt.expiresAt,
        duration: quiz.duration,
        totalQuestions: quiz.questions.length
      },
      quiz: {
        _id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        course: quiz.course,
        duration: quiz.duration,
        points: quiz.points,
        questions: formattedQuestions
      }
    });

  } catch (error) {
    console.error('Start quiz error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// Get active quiz attempt
router.get('/quiz-attempt/:attemptId', isStudent, async (req, res) => {
  try {
    const attemptId = req.params.attemptId;
    
    const attempt = await QuizAttempt.findOne({
      _id: attemptId,
      student: req.user._id
    }).populate({
      path: 'quiz',
      populate: {
        path: 'questions',
        select: 'questionText type options points'
      }
    }).populate('course', 'title');

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Tentative non trouvée'
      });
    }

    // Check if attempt has expired
    if (attempt.status === 'in_progress' && new Date() > attempt.expiresAt) {
      attempt.status = 'expired';
      await attempt.save();
      
      return res.status(410).json({
        success: false,
        message: 'Cette tentative a expiré',
        status: 'expired'
      });
    }

    // Format questions without correct answers
    const formattedQuestions = attempt.quiz.questions.map((question, index) => {
      const questionData = {
        _id: question._id,
        questionNumber: index + 1,
        questionText: question.questionText,
        type: question.type,
        points: question.points
      };

      if (question.type === 'multiple_choice' && question.options) {
        questionData.options = question.options.map(option => ({
          _id: option._id,
          text: option.text
        }));
      }

      return questionData;
    });

    res.json({
      success: true,
      attempt: {
        _id: attempt._id,
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt,
        status: attempt.status,
        answers: attempt.answers,
        currentQuestion: attempt.answers.length + 1,
        totalQuestions: attempt.totalQuestions
      },
      quiz: {
        _id: attempt.quiz._id,
        title: attempt.quiz.title,
        description: attempt.quiz.description,
        course: attempt.course,
        questions: formattedQuestions
      }
    });

  } catch (error) {
    console.error('Get attempt error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Submit answer for a question
router.post('/quiz-attempt/:attemptId/answer', isStudent, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { questionId, answer, timeSpent } = req.body;

    console.log('Submitting answer:', { attemptId, questionId, answer, timeSpent });

    const attempt = await QuizAttempt.findOne({
      _id: attemptId,
      student: req.user._id,
      status: 'in_progress'
    });

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Tentative non trouvée ou déjà terminée'
      });
    }

    // Check if attempt has expired
    if (new Date() > attempt.expiresAt) {
      attempt.status = 'expired';
      await attempt.save();
      
      return res.status(410).json({
        success: false,
        message: 'Le temps imparti est écoulé',
        status: 'expired'
      });
    }

    // Check if question was already answered
    const existingAnswerIndex = attempt.answers.findIndex(
      a => a.questionId.toString() === questionId
    );

    const answerData = {
      questionId,
      answer,
      timeSpent: timeSpent || 0,
      answeredAt: new Date()
    };

    if (existingAnswerIndex >= 0) {
      // Update existing answer
      attempt.answers[existingAnswerIndex] = answerData;
    } else {
      // Add new answer
      attempt.answers.push(answerData);
    }

    await attempt.save();

    res.json({
      success: true,
      message: 'Réponse enregistrée',
      currentQuestion: attempt.answers.length,
      totalQuestions: attempt.totalQuestions,
      isLastQuestion: attempt.answers.length >= attempt.totalQuestions
    });

  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement de la réponse'
    });
  }
});

// Get student's quiz history
router.get('/quiz-history', isStudent, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const attempts = await QuizAttempt.find({ student: req.user._id })
      .populate('quiz', 'title')
      .populate('course', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await QuizAttempt.countDocuments({ student: req.user._id });

    const formattedAttempts = attempts.map(attempt => ({
      _id: attempt._id,
      quiz: attempt.quiz,
      course: attempt.course,
      score: attempt.score,
      status: attempt.status,
      completedAt: attempt.completedAt,
      createdAt: attempt.createdAt,
      timeSpent: attempt.completedAt && attempt.startedAt ? 
        Math.round((attempt.completedAt - attempt.startedAt) / 1000 / 60) : null
    }));

    res.json({
      success: true,
      attempts: formattedAttempts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });

  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique'
    });
  }
});


// Get a specific quiz for taking (with questions but without correct answers)
router.get('/quiz/:id', isStudent, async (req, res) => {
  try {
    const quizId = req.params.id;
    console.log('Getting quiz for student:', quizId);

    // Find the quiz and populate questions
    const quiz = await Quiz.findById(quizId)
      .populate({
        path: 'questions',
        select: 'questionText type options explanation points'
      })
      .populate('course', 'title')
      .populate('instructor', 'firstName lastName');

    if (!quiz) {
      return res.status(404).json({ 
        success: false,
        message: 'Quiz non trouvé' 
      });
    }

    // Check if student is enrolled in the course
    const course = await Course.findOne({
      _id: quiz.course._id,
      'students.studentId': req.user._id
    });

    if (!course) {
      return res.status(403).json({ 
        success: false,
        message: 'Vous n\'êtes pas inscrit à ce cours' 
      });
    }

    // Only show published quizzes
    if (quiz.status !== 'published') {
      return res.status(403).json({ 
        success: false,
        message: 'Ce quiz n\'est pas encore disponible' 
      });
    }

    // Get student's attempts for this quiz
    const attempts = await QuizAttempt.find({
      student: req.user._id,
      quiz: quizId
    }).select('score status createdAt completedAt').sort({ createdAt: -1 });

    // Check for active attempt
    const activeAttempt = attempts.find(a => a.status === 'in_progress');

    const formattedQuiz = {
      _id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      course: {
        _id: quiz.course._id,
        title: quiz.course.title
      },
      instructor: {
        _id: quiz.instructor._id,
        name: `${quiz.instructor.firstName} ${quiz.instructor.lastName}`
      },
      duration: quiz.duration,
      points: quiz.points,
      totalQuestions: quiz.questions.length,
      createdAt: quiz.createdAt,
      // Student specific data
      attempts: attempts.map(a => ({
        _id: a._id,
        score: a.score,
        status: a.status,
        createdAt: a.createdAt,
        completedAt: a.completedAt
      })),
      attemptCount: attempts.length,
      bestScore: attempts.length > 0 ? Math.max(...attempts.filter(a => a.score !== null).map(a => a.score)) : null,
      hasActiveAttempt: !!activeAttempt,
      activeAttemptId: activeAttempt ? activeAttempt._id : null,
      canTakeQuiz: !activeAttempt // Can take quiz if no active attempt
    };

    res.json({
      success: true,
      quiz: formattedQuiz
    });

  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur',
      error: error.message 
    });
  }
});

// =========================
//   ADDITIONAL ROUTES
// =========================

// Get course details for student
router.get('/course/:id', isStudent, async (req, res) => {
  try {
    const courseId = req.params.id;
    
    // Check if student is enrolled in this course
    const course = await Course.findOne({
      _id: courseId,
      'students.studentId': req.user._id
    }).populate('instructor', 'firstName lastName email')
      .populate({
        path: 'quizzes',
        match: { status: 'published' },
        select: 'title description duration points status createdAt'
      });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé ou vous n\'êtes pas inscrit'
      });
    }

    // Get student's enrollment info
    const studentEnrollment = course.students.find(
      s => s.studentId.toString() === req.user._id.toString()
    );

    // Get student's quiz attempts for this course
    const quizAttempts = await QuizAttempt.find({
      student: req.user._id,
      course: courseId
    }).populate('quiz', 'title');

    const courseData = {
      _id: course._id,
      title: course.title,
      description: course.description,
      instructor: {
        _id: course.instructor._id,
        name: `${course.instructor.firstName} ${course.instructor.lastName}`,
        email: course.instructor.email
      },
      enrolledAt: studentEnrollment ? studentEnrollment.enrolledAt : null,
      progress: studentEnrollment ? studentEnrollment.progress || 0 : 0,
      quizzes: course.quizzes || [],
      totalQuizzes: course.quizzes ? course.quizzes.length : 0,
      completedQuizzes: quizAttempts.filter(a => a.status === 'completed').length,
      averageScore: quizAttempts.length > 0 ? 
        Math.round(quizAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / quizAttempts.length) : 0,
      createdAt: course.createdAt
    };

    res.json({
      success: true,
      course: courseData
    });

  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Get student statistics
router.get('/statistics', isStudent, async (req, res) => {
  try {
    const studentId = req.user._id;

    // Get enrolled courses count
    const totalCourses = await Course.countDocuments({
      'students.studentId': studentId
    });

    // Get quiz attempts statistics
    const totalAttempts = await QuizAttempt.countDocuments({ student: studentId });
    const completedAttempts = await QuizAttempt.countDocuments({ 
      student: studentId, 
      status: 'completed' 
    });

    // Get average score
    const averageScoreResult = await QuizAttempt.aggregate([
      { $match: { student: studentId, status: 'completed' } },
      { $group: { _id: null, avgScore: { $avg: '$score' } } }
    ]);

    // Get best score
    const bestScoreResult = await QuizAttempt.aggregate([
      { $match: { student: studentId, status: 'completed' } },
      { $group: { _id: null, bestScore: { $max: '$score' } } }
    ]);

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentActivity = await QuizAttempt.countDocuments({
      student: studentId,
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get quiz performance by course
    const performanceBySource = await QuizAttempt.aggregate([
      { $match: { student: studentId, status: 'completed' } },
      { $lookup: { from: 'courses', localField: 'course', foreignField: '_id', as: 'courseInfo' } },
      { $unwind: '$courseInfo' },
      { $group: { 
          _id: '$courseInfo._id',
          courseName: { $first: '$courseInfo.title' },
          totalAttempts: { $sum: 1 },
          averageScore: { $avg: '$score' },
          bestScore: { $max: '$score' }
        }
      },
      { $sort: { averageScore: -1 } }
    ]);

    const statistics = {
      overview: {
        totalCourses,
        totalQuizAttempts: totalAttempts,
        completedQuizzes: completedAttempts,
        averageScore: averageScoreResult.length > 0 ? Math.round(averageScoreResult[0].avgScore) : 0,
        bestScore: bestScoreResult.length > 0 ? bestScoreResult[0].bestScore : 0,
        recentActivity: recentActivity
      },
      performance: {
        completionRate: totalAttempts > 0 ? Math.round((completedAttempts / totalAttempts) * 100) : 0,
        improvementTrend: 'stable', // You can implement trend calculation logic
        strongSubjects: performanceBySource.slice(0, 3),
        weakSubjects: performanceBySource.slice(-3).reverse()
      },
      activity: {
        last30Days: recentActivity,
        thisWeek: await QuizAttempt.countDocuments({
          student: studentId,
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }),
        today: await QuizAttempt.countDocuments({
          student: studentId,
          createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        })
      }
    };

    res.json({
      success: true,
      statistics
    });

  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
});

// Search quizzes
router.get('/search/quizzes', isStudent, async (req, res) => {
  try {
    const { q, course, limit = 10 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Le terme de recherche doit contenir au moins 2 caractères'
      });
    }

    // Get courses student is enrolled in
    const enrolledCourses = await Course.find({ 'students.studentId': req.user._id });
    if (!enrolledCourses || enrolledCourses.length === 0) {
      return res.json({ 
        success: true, 
        quizzes: [] 
      });
    }

    // Build search query
    const query = {
      course: { $in: enrolledCourses.map(c => c._id) },
      status: 'published', // Use the correct status field
      $and: [
        { startDate: { $lte: new Date() } }, // Quiz has started
        { $or: [
          { endDate: { $gte: new Date() } }, // Quiz hasn't ended
          { endDate: { $exists: false } } // No end date set
        ]}
      ]
    };

    // Filter by specific course if provided
    if (course) {
      query.course = course;
    }

    // Add search query if present
    if (q) {
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ];
    }

    const quizzes = await Quiz.find(query)
      .populate('course', 'title')
      .populate('instructor', 'firstName lastName')
      .select('title description course instructor duration points createdAt')
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      quizzes: quizzes.map(quiz => ({
        _id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        course: quiz.course,
        instructor: {
          _id: quiz.instructor._id,
          name: `${quiz.instructor.firstName} ${quiz.instructor.lastName}`
        },
        duration: quiz.duration,
        points: quiz.points,
        createdAt: quiz.createdAt
      })),
      totalFound: quizzes.length
    });

  } catch (error) {
    console.error('Search quizzes error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche'
    });
  }
});

// Get notifications for student
router.get('/notifications', isStudent, async (req, res) => {
  try {
    // This is a placeholder for notifications system
    // You would implement actual notification logic based on your requirements
    
    const notifications = [
      {
        _id: 'notification1',
        type: 'quiz_published',
        title: 'Nouveau quiz disponible',
        message: 'Un nouveau quiz a été publié dans votre cours',
        read: false,
        createdAt: new Date()
      }
    ];

    res.json({
      success: true,
      notifications: notifications,
      unreadCount: notifications.filter(n => !n.read).length
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des notifications'
    });
  }
});

// List devoirs for a course the student is enrolled in
router.get('/courses/:courseId/devoirs', isStudent, async (req, res) => {
    try {
        const course = await Course.findOne({ _id: req.params.courseId, 'students.studentId': req.user._id });
        if (!course) {
            return res.status(403).json({ success: false, message: 'Accès refusé à ce cours.' });
        }
        const devoirs = await Devoir.find({ course: course._id }).sort({ createdAt: -1 });
        res.json({ success: true, devoirs });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Submit a PDF for a specific devoir
router.post('/devoirs/:devoirId/submit', isStudent, devoirUpload.single('pdf'), async (req, res) => {
    try {
        const devoir = await Devoir.findById(req.params.devoirId);
        if (!devoir) {
            return res.status(404).json({ success: false, message: 'Devoir non trouvé.' });
        }
        // Check if student is enrolled in the course
        const course = await Course.findOne({ _id: devoir.course, 'students.studentId': req.user._id });
        if (!course) {
            return res.status(403).json({ success: false, message: 'Accès refusé à ce devoir.' });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Le fichier PDF est requis.' });
        }
        // Upsert submission (one per student per devoir)
        const fileUrl = `/uploads/students/devoirs/${req.file.filename}`;
        const submission = await DevoirSubmission.findOneAndUpdate(
            { devoir: devoir._id, student: req.user._id },
            { fileUrl, submittedAt: new Date() },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        res.json({ success: true, submission });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Get student's own submission for a devoir
router.get('/devoirs/:devoirId/submission', isStudent, async (req, res) => {
    try {
        const submission = await DevoirSubmission.findOne({ devoir: req.params.devoirId, student: req.user._id });
        res.json({ success: true, submission });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

module.exports = router;