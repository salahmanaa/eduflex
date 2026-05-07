const express = require('express');
const router = express.Router();
const {
  getInstructors,
  addInstructor,
  updateInstructor,
  deleteInstructor,
  getStudents,
  updateStudent,
  deleteStudent,
  createAdmin,
  getPlatformStats,
  getUserRegistrationsStats,
  getTopCourses,
  getRecentRegistrations,
  getQuizParticipation,
  getActiveUsers,
  getReports,
  createReport,
  deleteReport,
  getScheduledReports,
  createScheduledReport,
  deleteScheduledReport
} = require('../controllers/adminController');

const authenticateUser = require('../middleware/auth');
const checkRole = require('../middleware/roleMiddleware');

// All routes in this file are protected and for admins only
router.use(authenticateUser);
router.use(checkRole('admin'));

// Routes for instructors
router.route('/instructors')
  .get(getInstructors)
  .post(addInstructor);

router.route('/instructors/:id')
  .put(updateInstructor)
  .delete(deleteInstructor);

// Routes for students
router.route('/students')
  .get(getStudents);

router.route('/students/:id')
  .put(updateStudent)
  .delete(deleteStudent);

// Route for creating a new admin
router.route('/admins').post(createAdmin);

// Route for platform statistics
router.get('/stats', getPlatformStats);

// Route for user registrations stats
router.get('/user-registrations', getUserRegistrationsStats);

// New analytics routes
router.get('/top-courses', getTopCourses);
router.get('/recent-registrations', getRecentRegistrations);
router.get('/quiz-participation', getQuizParticipation);
router.get('/active-users', getActiveUsers);

// Reports routes
router.route('/reports')
  .get(getReports)
  .post(createReport);
router.route('/reports/:id')
  .delete(deleteReport);

// Scheduled reports routes
router.route('/scheduled-reports')
  .get(getScheduledReports)
  .post(createScheduledReport);
router.route('/scheduled-reports/:id')
  .delete(deleteScheduledReport);

module.exports = router;
