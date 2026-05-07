const User = require('../models/User');
const Course = require('../models/Course');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Devoir = require('../models/Devoir');
const DevoirSubmission = require('../models/DevoirSubmission');
const Event = require('../models/Event');
const Discussion = require('../models/discussion');

// Get teacher dashboard statistics
const getDashboardStats = async (req, res) => {
    try {
        const teacherId = req.user._id;

        // Get courses taught by this teacher
        const courses = await Course.find({ instructor: teacherId })
            .populate('students.studentId', 'firstName lastName');

        // Get total students across all courses
        const totalStudents = courses.reduce((sum, course) => {
            return sum + (course.students?.length || 0);
        }, 0);

        // Get pending assignments to grade
        const pendingAssignments = await DevoirSubmission.find({
            status: 'pending',
            devoir: { $in: await Devoir.find({ instructor: teacherId }).select('_id') }
        }).populate('devoir', 'title course')
          .populate('student', 'firstName lastName');

        // Get recent quiz attempts for teacher's courses
        const recentQuizAttempts = await QuizAttempt.find({
            course: { $in: courses.map(c => c._id) }
        }).populate('quiz', 'title')
          .populate('course', 'title')
          .populate('student', 'firstName lastName')
          .sort({ createdAt: -1 })
          .limit(10);

        // Get today's events
        const todayEvents = await Event.findTodayEvents(teacherId)
            .populate('course', 'title')
            .populate('students', 'firstName lastName');

        // Get next 3 upcoming events (today and future)
        const upcomingEvents = await Event.findUpcomingEvents(teacherId, 3)
            .populate('course', 'title')
            .populate('students', 'firstName lastName');

        // Merge today's events and upcoming events, remove duplicates by _id
        const allEventsMap = new Map();
        todayEvents.forEach(ev => allEventsMap.set(ev._id.toString(), ev));
        upcomingEvents.forEach(ev => allEventsMap.set(ev._id.toString(), ev));
        const allEvents = Array.from(allEventsMap.values())
            .sort((a, b) => new Date(a.start) - new Date(b.start))
            .slice(0, 3);

        // Get recent forum questions
        const recentQuestions = await Discussion.getRecentQuestionsForTeacher(teacherId, 5);

        // Calculate average course ratings (mock data for now)
        const courseRatings = courses.map(course => ({
            courseId: course._id,
            title: course.title,
            rating: (Math.random() * 2 + 3).toFixed(1), // Random rating between 3-5
            reviewCount: Math.floor(Math.random() * 50) + 5
        }));

        // Calculate statistics
        const stats = {
            activeCourses: courses.length,
            totalStudents: totalStudents,
            pendingAssignments: pendingAssignments.length,
            teachingHours: Math.floor(Math.random() * 100) + 20, // Mock data
            averageSatisfaction: 92, // Mock data
            recentCourses: [],
            recentQuizAttempts: [],
            pendingGrading: [],
            studentQuestions: [],
            todayEvents: []
        };

        // Get recent courses (last 4)
        stats.recentCourses = courses.slice(0, 4).map(course => {
            const courseRating = courseRatings.find(r => r.courseId.toString() === course._id.toString());
            return {
                id: course._id,
                title: course.title,
                category: course.category,
                studentCount: course.students?.length || 0,
                rating: courseRating?.rating || '4.0',
                reviewCount: courseRating?.reviewCount || 0,
                thumbnail: course.thumbnail || `https://placehold.co/100x100?text=${course.category.charAt(0)}`
            };
        });

        // Get recent quiz attempts (last 5)
        stats.recentQuizAttempts = recentQuizAttempts.slice(0, 5).map(attempt => ({
            id: attempt._id,
            studentName: `${attempt.student.firstName} ${attempt.student.lastName}`,
            quizTitle: attempt.quiz.title,
            courseTitle: attempt.course.title,
            score: attempt.score,
            completedAt: attempt.completedAt
        }));

        // Get pending assignments to grade (last 5)
        stats.pendingGrading = pendingAssignments.slice(0, 5).map(submission => ({
            id: submission._id,
            studentName: `${submission.student.firstName} ${submission.student.lastName}`,
            assignmentTitle: submission.devoir.title,
            courseTitle: submission.devoir.course.title,
            submittedAt: submission.submittedAt,
            daysSinceSubmission: Math.ceil((new Date() - submission.submittedAt) / (1000 * 60 * 60 * 24))
        }));

        // Format real forum questions
        stats.studentQuestions = recentQuestions.map(question => ({
            id: question._id,
            studentName: question.author ? `${question.author.firstName} ${question.author.lastName}` : 'Anonyme',
            course: question.course?.title || getCategoryLabel(question.category),
            question: question.title,
            timeAgo: question.timeAgo,
            isAnswered: question.isAnswered,
            commentsCount: question.commentsCount
        }));

        // Format today's events for dashboard (now: upcoming events)
        stats.todayEvents = allEvents.map(event => ({
            id: event._id,
            title: event.title,
            start: event.start,
            end: event.end,
            category: event.category,
            courseTitle: event.course?.title || 'Événement général',
            studentCount: event.students?.length || 0,
            location: event.location || 'En ligne'
        }));

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        console.error('Error getting teacher dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des statistiques'
        });
    }
};

// Helper function to get category label
function getCategoryLabel(category) {
    const labels = {
        'web': 'Développement Web',
        'ia': 'Intelligence Artificielle',
        'data': 'Data Science',
        'design': 'Design UI/UX',
        'general': 'Général'
    };
    return labels[category] || 'Général';
}

// Get teacher profile
const getProfile = async (req, res) => {
    try {
        const teacher = await User.findById(req.user._id)
            .select('-password');

        if (!teacher) {
            return res.status(404).json({ 
                success: false,
                message: 'Enseignant non trouvé' 
            });
        }

        res.json({
            success: true,
            teacher
        });
    } catch (error) {
        console.error('Error getting teacher profile:', error);
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
