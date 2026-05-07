const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Course = require('../models/Course');

const startQuizAttempt = async (req, res) => {
    try {
        const { quizId } = req.params;
        const user = req.user;

        const quiz = await Quiz.findById(quizId)
            .populate('course', 'name')
            .populate('questions');

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        if (quiz.status !== 'published') {
            return res.status(403).json({ message: 'This quiz is not published.' });
        }

        if (quiz.course) {
            const isEnrolled = await Course.exists({
                _id: quiz.course._id,
                'students.studentId': user._id
            });
            if (!isEnrolled) {
                return res.status(403).json({ message: 'You are not enrolled in this course.' });
            }
        }

        const now = new Date();
        if (quiz.startDate && quiz.startDate > now) {
            return res.status(403).json({ message: `This quiz is not available until ${quiz.startDate.toLocaleString()}.` });
        }
        if (quiz.endDate && quiz.endDate < now) {
            return res.status(403).json({ message: 'This quiz has expired.' });
        }

        const attempts = await QuizAttempt.countDocuments({ student: user._id, quiz: quiz._id });
        if (quiz.maxAttempts > 0 && attempts >= quiz.maxAttempts) {
            return res.status(403).json({ message: 'You have reached the maximum number of attempts.' });
        }

        const startTime = new Date();
        const timeLimit = quiz.timeLimit || quiz.duration || 30; // Fallback for old data
        const endTime = new Date(startTime.getTime() + timeLimit * 60000);

        const newAttempt = new QuizAttempt({
            student: user._id,
            quiz: quiz._id,
            course: quiz.course?._id,
            startedAt: startTime,
            expiresAt: endTime,
            status: 'in_progress',
            totalQuestions: quiz.questions?.length || 0
        });

        await newAttempt.save();
        
        const quizData = quiz.toObject();
        quizData.questions = quiz.questions.map(q => ({
            _id: q._id,
            text: q.text || q.questionText || '',
            type: q.type,
            options: Array.isArray(q.options)
                ? q.options.map(opt => (typeof opt === 'object' ? (opt.value || opt.text || String(opt)) : String(opt)))
                : [],
        }));

        res.json({
            success: true,
            quiz: quizData,
            attempt: {
                _id: newAttempt._id,
                startTime: newAttempt.startedAt,
                endTime: newAttempt.expiresAt
            }
        });

    } catch (error) {
        console.error('--- QUIZ START ERROR ---');
        console.error(`Time: ${new Date().toISOString()}`);
        console.error(`User: ${req.user?._id}`);
        console.error(`Quiz ID: ${req.params.quizId}`);
        console.error(error);
        console.error('--- END QUIZ START ERROR ---');

        res.status(500).json({ 
            success: false, 
            message: 'An error occurred while starting the quiz.',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

module.exports = {
    startQuizAttempt
}; 