const User = require('../models/User');
const Course = require('../models/Course');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Devoir = require('../models/Devoir');
const DevoirSubmission = require('../models/DevoirSubmission');
const Event = require('../models/Event');

// Get student dashboard statistics
const getDashboardStats = async (req, res) => {
    try {
        const studentId = req.user._id;

        // Get enrolled courses
        const enrolledCourses = await Course.find({ 
            'students.studentId': studentId 
        }).populate('instructor', 'firstName lastName');

        // Get quiz attempts
        const quizAttempts = await QuizAttempt.find({ student: studentId })
            .populate('quiz', 'title')
            .populate('course', 'title')
            .sort({ createdAt: -1 });

        // Get devoir submissions
        const devoirSubmissions = await DevoirSubmission.find({ student: studentId })
            .populate('devoir', 'title course')
            .sort({ submittedAt: -1 });

        // Get today's events
        const todayEvents = await Event.findTodayEvents(studentId)
            .populate('course', 'title')
            .populate('instructor', 'firstName lastName');

        // Calculate statistics
        const stats = {
            activeCourses: enrolledCourses.length,
            certifications: quizAttempts.filter(attempt => attempt.score >= 80).length,
            pendingAssignments: devoirSubmissions.filter(sub => sub.status === 'pending').length,
            studyHours: Math.floor(Math.random() * 50) + 10, // Mock data for now
            totalProgress: 0,
            recentCourses: [],
            recentQuizAttempts: [],
            recentAssignments: [],
            upcomingDeadlines: [],
            todayEvents: []
        };

        // Calculate total progress
        if (enrolledCourses.length > 0) {
            const totalProgress = enrolledCourses.reduce((sum, course) => {
                const studentEnrollment = course.students.find(s => 
                    s.studentId.toString() === studentId.toString()
                );
                return sum + (studentEnrollment?.progress || 0);
            }, 0);
            stats.totalProgress = Math.round(totalProgress / enrolledCourses.length);
        }

        // Get recent courses (last 4)
        stats.recentCourses = enrolledCourses.slice(0, 4).map(course => {
            const studentEnrollment = course.students.find(s => 
                s.studentId.toString() === studentId.toString()
            );
            return {
                id: course._id,
                title: course.title,
                category: course.category,
                instructor: `${course.instructor.firstName} ${course.instructor.lastName}`,
                progress: studentEnrollment?.progress || 0,
                thumbnail: course.thumbnail || `https://placehold.co/100x100?text=${course.category.charAt(0)}`
            };
        });

        // Get recent quiz attempts (last 5)
        stats.recentQuizAttempts = quizAttempts.slice(0, 5).map(attempt => ({
            id: attempt._id,
            quizTitle: attempt.quiz.title,
            courseTitle: attempt.course.title,
            score: attempt.score,
            completedAt: attempt.completedAt,
            status: attempt.score >= 80 ? 'passed' : 'failed'
        }));

        // Get recent assignments (last 5)
        stats.recentAssignments = devoirSubmissions.slice(0, 5).map(submission => ({
            id: submission._id,
            title: submission.devoir.title,
            courseTitle: submission.devoir.course.title,
            status: submission.status,
            submittedAt: submission.submittedAt,
            grade: submission.grade
        }));

        // Get upcoming deadlines (next 7 days)
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        const upcomingDevoirs = await Devoir.find({
            course: { $in: enrolledCourses.map(c => c._id) },
            dueDate: { $gte: new Date(), $lte: nextWeek }
        }).populate('course', 'title');

        stats.upcomingDeadlines = upcomingDevoirs.map(devoir => ({
            id: devoir._id,
            title: devoir.title,
            courseTitle: devoir.course.title,
            dueDate: devoir.dueDate,
            daysLeft: Math.ceil((devoir.dueDate - new Date()) / (1000 * 60 * 60 * 24))
        }));

        // Format today's events for dashboard
        stats.todayEvents = todayEvents.map(event => ({
            id: event._id,
            title: event.title,
            start: event.start,
            end: event.end,
            category: event.category,
            courseTitle: event.course?.title || 'Événement général',
            instructor: event.instructor ? `${event.instructor.firstName} ${event.instructor.lastName}` : 'Non assigné',
            location: event.location || 'En ligne'
        }));

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        console.error('Error getting student dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des statistiques'
        });
    }
};

// Get student profile
const getProfile = async (req, res) => {
    try {
        const student = await User.findById(req.user._id)
            .select('-password');

        if (!student) {
            return res.status(404).json({ 
                success: false,
                message: 'Étudiant non trouvé' 
            });
        }

        res.json({
            success: true,
            student
        });
    } catch (error) {
        console.error('Error getting student profile:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    }
};

module.exports = {
    getDashboardStats,
    getProfile
};
