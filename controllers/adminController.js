const User = require('../models/User');
const Course = require('../models/Course');
const Quiz = require('../models/Quiz');
const Report = require('../models/Report');
const ScheduledReport = require('../models/ScheduledReport');
const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

// @desc    Get all instructors
// @route   GET /api/admin/instructors
// @access  Private/Admin
const getInstructors = async (req, res) => {
  try {
    const instructors = await User.find({ role: 'teacher' }).select('-password');
    res.json(instructors);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Add a new instructor
// @route   POST /api/admin/instructors
// @access  Private/Admin
const addInstructor = async (req, res) => {
  const { firstName, lastName, email, password, specialty, bio, linkedIn } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await require('bcrypt').genSalt(10);
    const hashedPassword = await require('bcrypt').hash(password, salt);

    const instructor = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: 'teacher',
      specialty,
      bio,
      linkedIn
    });

    res.status(201).json({
        _id: instructor._id,
        firstName: instructor.firstName,
        lastName: instructor.lastName,
        email: instructor.email,
        role: instructor.role
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update an instructor
// @route   PUT /api/admin/instructors/:id
// @access  Private/Admin
const updateInstructor = async (req, res) => {
  const { firstName, lastName, email, specialty, bio, linkedIn } = req.body;

  try {
    const instructor = await User.findById(req.params.id);

    if (instructor) {
      instructor.firstName = firstName || instructor.firstName;
      instructor.lastName = lastName || instructor.lastName;
      instructor.email = email || instructor.email;
      instructor.specialty = specialty || instructor.specialty;
      instructor.bio = bio || instructor.bio;
      instructor.linkedIn = linkedIn || instructor.linkedIn;

      const updatedInstructor = await instructor.save();
      res.json(updatedInstructor);
    } else {
      res.status(404).json({ message: 'Instructor not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete an instructor
// @route   DELETE /api/admin/instructors/:id
// @access  Private/Admin
const deleteInstructor = async (req, res) => {
  try {
    const instructor = await User.findById(req.params.id);

    if (instructor) {
      await instructor.deleteOne(); // or .remove() for older mongoose versions
      res.json({ message: 'Instructor removed' });
    } else {
      res.status(404).json({ message: 'Instructor not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all students
// @route   GET /api/admin/students
// @access  Private/Admin
const getStudents = async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }).select('-password');
    res.json(students);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update a student
// @route   PUT /api/admin/students/:id
// @access  Private/Admin
const updateStudent = async (req, res) => {
  const { firstName, lastName, email, phone, birthDate } = req.body;
  try {
    const student = await User.findById(req.params.id);
    if (student) {
      student.firstName = firstName || student.firstName;
      student.lastName = lastName || student.lastName;
      student.email = email || student.email;
      student.phone = phone || student.phone;
      student.birthDate = birthDate || student.birthDate;
      const updatedStudent = await student.save();
      res.json(updatedStudent);
    } else {
      res.status(404).json({ message: 'Student not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete a student
// @route   DELETE /api/admin/students/:id
// @access  Private/Admin
const deleteStudent = async (req, res) => {
  try {
    const student = await User.findById(req.params.id);
    if (student) {
      await student.deleteOne();
      res.json({ message: 'Student removed' });
    } else {
      res.status(404).json({ message: 'Student not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Add a new admin
// @route   POST /api/admin/admins
// @access  Private/Admin
const createAdmin = async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }
    const salt = await require('bcrypt').genSalt(10);
    const hashedPassword = await require('bcrypt').hash(password, salt);
    const admin = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: 'admin'
    });
    res.status(201).json({
      _id: admin._id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      role: admin.role
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get platform statistics
// @route   GET /api/admin/stats
// @access  Private/Admin
const getPlatformStats = async (req, res) => {
  try {
    const [studentCount, teacherCount, adminCount, courseCount, quizCount] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'teacher' }),
      User.countDocuments({ role: 'admin' }),
      Course.countDocuments(),
      Quiz.countDocuments()
    ]);
    res.json({
      students: studentCount,
      teachers: teacherCount,
      admins: adminCount,
      courses: courseCount,
      quizzes: quizCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get user registrations per month (last 6 months)
// @route   GET /api/admin/user-registrations
// @access  Private/Admin
const getUserRegistrationsStats = async (req, res) => {
  try {
    const period = req.query.period || 'month';
    const now = new Date();
    let data = [];
    if (period === 'day') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        const label = start.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' });
        const count = await User.countDocuments({ createdAt: { $gte: start, $lt: end } });
        data.push({ label, count });
      }
    } else if (period === 'week') {
      // Last 8 weeks
      let current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      // Set to start of this week (Monday)
      current.setDate(current.getDate() - (current.getDay() === 0 ? 6 : current.getDay() - 1));
      for (let i = 7; i >= 0; i--) {
        const start = new Date(current.getFullYear(), current.getMonth(), current.getDate() - i * 7);
        const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
        const weekNum = getWeekNumber(start);
        const month = String(start.getMonth() + 1).padStart(2, '0');
        const label = `S${weekNum} ${month}`;
        const count = await User.countDocuments({ createdAt: { $gte: start, $lt: end } });
        data.push({ label, count });
      }
      console.log('Generated weekly labels:', data.map(d => d.label));
    } else {
      // Last 6 months (default)
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const label = start.toLocaleString('default', { month: 'short', year: '2-digit' });
        const count = await User.countDocuments({ createdAt: { $gte: start, $lt: end } });
        data.push({ label, count });
      }
    }
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Helper to get ISO week number
function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
  return weekNo;
}

// @desc    Get top 5 courses by enrollment
// @route   GET /api/admin/top-courses
// @access  Private/Admin
const getTopCourses = async (req, res) => {
  try {
    const courses = await Course.aggregate([
      { $addFields: { enrolledCount: { $size: { $ifNull: ["$students", []] } } } },
      { $sort: { enrolledCount: -1 } },
      { $limit: 5 },
      { $project: { title: 1, enrolledCount: 1 } }
    ]);
    console.log('Top Courses:', courses);
    res.json(courses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get recent user registrations (last 7 days)
// @route   GET /api/admin/recent-registrations
// @access  Private/Admin
const getRecentRegistrations = async (req, res) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const users = await User.find({ createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .select('firstName lastName email createdAt role');
    console.log('Recent Registrations:', users);
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get quiz participation (last 30 days)
// @route   GET /api/admin/quiz-participation
// @access  Private/Admin
const getQuizParticipation = async (req, res) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const quizzes = await Quiz.find({ createdAt: { $gte: since } })
      .select('title participants createdAt');
    const participation = quizzes.map(q => ({
      title: q.title,
      count: q.participants ? q.participants.length : 0,
      createdAt: q.createdAt
    }));
    console.log('Quiz Participation:', participation);
    res.json(participation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get active users (last 7 days)
// @route   GET /api/admin/active-users
// @access  Private/Admin
const getActiveUsers = async (req, res) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const users = await User.find({ lastLogin: { $gte: since } }).countDocuments();
    console.log('Active Users:', users);
    res.json({ activeUsers: users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all reports
// @route   GET /api/admin/reports
// @access  Private/Admin
const getReports = async (req, res) => {
  try {
    const reports = await Report.find().sort({ generatedAt: -1 }).limit(20);
    res.json(reports);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a new report (simulate generation)
// @route   POST /api/admin/reports
// @access  Private/Admin
const createReport = async (req, res) => {
  try {
    const { name, type, format, period } = req.body;
    const generatedBy = req.user ? req.user.firstName + ' ' + req.user.lastName : 'Admin';
    let fileUrl = '';
    let status = 'ready';
    const reportsDir = path.join(__dirname, '../public/uploads/reports');
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

    // Calculate date filter based on period
    let dateFilter = {};
    if (period) {
      let from = new Date();
      switch (period) {
        case 'day':
          from.setHours(0, 0, 0, 0);
          break;
        case 'week':
          from.setDate(from.getDate() - from.getDay());
          from.setHours(0, 0, 0, 0);
          break;
        case 'month':
          from.setDate(1);
          from.setHours(0, 0, 0, 0);
          break;
        case 'year':
          from = new Date(from.getFullYear(), 0, 1);
          break;
        default:
          from = null;
      }
      if (from) {
        dateFilter = { $gte: from };
      }
    }

    // User Activity Reports (enriched)
    if (type === 'Activité des Utilisateurs') {
      const userQuery = dateFilter.$gte ? { createdAt: dateFilter } : {};
      const users = await User.find(userQuery).select('firstName lastName email role phone createdAt lastLogin');
      // Enrich: number of courses, number of quizzes
      const courses = await Course.find();
      const quizzes = await Quiz.find();
      const userStats = users.map(u => {
        const userCourses = courses.filter(c => c.students.some(s => s.studentId && s.studentId.equals(u._id)));
        const userQuizzes = quizzes.filter(q => q.participants && q.participants.some(p => p.student && p.student.equals(u._id)));
        const quizScores = quizzes.flatMap(q => (q.participants || []).filter(p => p.student && p.student.equals(u._id)).map(p => p.score)).filter(s => typeof s === 'number');
        return {
          ...u.toObject(),
          nbCourses: userCourses.length,
          nbQuizzes: userQuizzes.length,
          avgQuizScore: quizScores.length ? (quizScores.reduce((a, b) => a + b, 0) / quizScores.length).toFixed(2) : ''
        };
      });
      if (format === 'CSV') {
        const fields = [
          { label: 'Prénom', value: 'firstName' },
          { label: 'Nom', value: 'lastName' },
          { label: 'Email', value: 'email' },
          { label: 'Téléphone', value: 'phone' },
          { label: 'Rôle', value: 'role' },
          { label: 'Date d\'inscription', value: row => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '' },
          { label: 'Dernière connexion', value: row => row.lastLogin ? new Date(row.lastLogin).toLocaleDateString() : '' },
          { label: 'Cours suivis', value: 'nbCourses' },
          { label: 'Quiz passés', value: 'nbQuizzes' },
          { label: 'Moyenne Quiz', value: 'avgQuizScore' }
        ];
        const parser = new Parser({ fields });
        const csv = parser.parse(userStats);
        const filePath = path.join(reportsDir, name + '.csv');
        fs.writeFileSync(filePath, csv);
        fileUrl = '/uploads/reports/' + name + '.csv';
      } else if (format === 'PDF') {
        const filePath = path.join(reportsDir, name + '.pdf');
        const doc = new PDFDocument({ margin: 30 });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);
        doc.fontSize(18).text('Rapport: Activité des Utilisateurs', { align: 'center' });
        doc.moveDown();
        userStats.forEach(u => {
          doc.fontSize(12).text(`Nom: ${u.firstName} ${u.lastName}`);
          doc.text(`Email: ${u.email}`);
          doc.text(`Téléphone: ${u.phone || ''}`);
          doc.text(`Rôle: ${u.role}`);
          doc.text(`Inscription: ${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : ''}`);
          doc.text(`Dernière connexion: ${u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : ''}`);
          doc.text(`Cours suivis: ${u.nbCourses}`);
          doc.text(`Quiz passés: ${u.nbQuizzes}`);
          doc.text(`Moyenne Quiz: ${u.avgQuizScore}`);
          doc.moveDown();
        });
        doc.end();
        await new Promise(resolve => stream.on('finish', resolve));
        fileUrl = '/uploads/reports/' + name + '.pdf';
      } else if (format === 'Excel') {
        const filePath = path.join(reportsDir, name + '.xlsx');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Utilisateurs');
        sheet.columns = [
          { header: 'Prénom', key: 'firstName' },
          { header: 'Nom', key: 'lastName' },
          { header: 'Email', key: 'email' },
          { header: 'Téléphone', key: 'phone' },
          { header: 'Rôle', key: 'role' },
          { header: 'Date d\'inscription', key: 'createdAt' },
          { header: 'Dernière connexion', key: 'lastLogin' },
          { header: 'Cours suivis', key: 'nbCourses' },
          { header: 'Quiz passés', key: 'nbQuizzes' },
          { header: 'Moyenne Quiz', key: 'avgQuizScore' }
        ];
        userStats.forEach(u => {
          sheet.addRow({
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            phone: u.phone,
            role: u.role,
            createdAt: u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '',
            lastLogin: u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : '',
            nbCourses: u.nbCourses,
            nbQuizzes: u.nbQuizzes,
            avgQuizScore: u.avgQuizScore
          });
        });
        await workbook.xlsx.writeFile(filePath);
        fileUrl = '/uploads/reports/' + name + '.xlsx';
      }
    }
    // Performance des Formateurs
    else if (type === 'Performance des Formateurs') {
      const teacherQuery = dateFilter.$gte ? { role: 'teacher', createdAt: dateFilter } : { role: 'teacher' };
      const teachers = await User.find(teacherQuery).select('firstName lastName email lastLogin');
      const courses = await Course.find(dateFilter.$gte ? { createdAt: dateFilter } : {});
      const quizzes = await Quiz.find(dateFilter.$gte ? { createdAt: dateFilter } : {});
      const teacherStats = teachers.map(t => {
        const teacherCourses = courses.filter(c => c.instructor && c.instructor.equals(t._id));
        const studentsTaught = new Set(teacherCourses.flatMap(c => c.students.map(s => s.studentId && s.studentId.toString())));
        const teacherQuizzes = quizzes.filter(q => q.instructor && q.instructor.equals(t._id));
        const quizScores = teacherQuizzes.flatMap(q => (q.participants || []).map(p => p.score)).filter(s => typeof s === 'number');
        return {
          ...t.toObject(),
          nbCourses: teacherCourses.length,
          nbStudents: studentsTaught.size,
          nbQuizzes: teacherQuizzes.length,
          avgQuizScore: quizScores.length ? (quizScores.reduce((a, b) => a + b, 0) / quizScores.length).toFixed(2) : ''
        };
      });
      if (format === 'CSV') {
        const fields = [
          { label: 'Prénom', value: 'firstName' },
          { label: 'Nom', value: 'lastName' },
          { label: 'Email', value: 'email' },
          { label: 'Cours enseignés', value: 'nbCourses' },
          { label: 'Étudiants enseignés', value: 'nbStudents' },
          { label: 'Quiz créés', value: 'nbQuizzes' },
          { label: 'Moyenne Quiz', value: 'avgQuizScore' },
          { label: 'Dernière connexion', value: row => row.lastLogin ? new Date(row.lastLogin).toLocaleDateString() : '' }
        ];
        const parser = new Parser({ fields });
        const csv = parser.parse(teacherStats);
        const filePath = path.join(reportsDir, name + '.csv');
        fs.writeFileSync(filePath, csv);
        fileUrl = '/uploads/reports/' + name + '.csv';
      } else if (format === 'PDF') {
        const filePath = path.join(reportsDir, name + '.pdf');
        const doc = new PDFDocument({ margin: 30 });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);
        doc.fontSize(18).text('Rapport: Performance des Formateurs', { align: 'center' });
        doc.moveDown();
        teacherStats.forEach(t => {
          doc.fontSize(12).text(`Nom: ${t.firstName} ${t.lastName}`);
          doc.text(`Email: ${t.email}`);
          doc.text(`Cours enseignés: ${t.nbCourses}`);
          doc.text(`Étudiants enseignés: ${t.nbStudents}`);
          doc.text(`Quiz créés: ${t.nbQuizzes}`);
          doc.text(`Moyenne Quiz: ${t.avgQuizScore}`);
          doc.text(`Dernière connexion: ${t.lastLogin ? new Date(t.lastLogin).toLocaleDateString() : ''}`);
          doc.moveDown();
        });
        doc.end();
        await new Promise(resolve => stream.on('finish', resolve));
        fileUrl = '/uploads/reports/' + name + '.pdf';
      } else if (format === 'Excel') {
        const filePath = path.join(reportsDir, name + '.xlsx');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Formateurs');
        sheet.columns = [
          { header: 'Prénom', key: 'firstName' },
          { header: 'Nom', key: 'lastName' },
          { header: 'Email', key: 'email' },
          { header: 'Cours enseignés', key: 'nbCourses' },
          { header: 'Étudiants enseignés', key: 'nbStudents' },
          { header: 'Quiz créés', key: 'nbQuizzes' },
          { header: 'Moyenne Quiz', key: 'avgQuizScore' },
          { header: 'Dernière connexion', key: 'lastLogin' }
        ];
        teacherStats.forEach(t => {
          sheet.addRow({
            firstName: t.firstName,
            lastName: t.lastName,
            email: t.email,
            nbCourses: t.nbCourses,
            nbStudents: t.nbStudents,
            nbQuizzes: t.nbQuizzes,
            avgQuizScore: t.avgQuizScore,
            lastLogin: t.lastLogin ? new Date(t.lastLogin).toLocaleDateString() : ''
          });
        });
        await workbook.xlsx.writeFile(filePath);
        fileUrl = '/uploads/reports/' + name + '.xlsx';
      }
    }
    // Engagement des Étudiants
    else if (type === 'Engagement des Étudiants') {
      const studentQuery = dateFilter.$gte ? { role: 'student', createdAt: dateFilter } : { role: 'student' };
      const students = await User.find(studentQuery).select('firstName lastName email lastLogin');
      const courses = await Course.find(dateFilter.$gte ? { createdAt: dateFilter } : {});
      const quizzes = await Quiz.find(dateFilter.$gte ? { createdAt: dateFilter } : {});
      const studentStats = students.map(s => {
        const studentCourses = courses.filter(c => c.students.some(stu => stu.studentId && stu.studentId.equals(s._id)));
        const studentQuizzes = quizzes.filter(q => q.participants && q.participants.some(p => p.student && p.student.equals(s._id)));
        const quizScores = quizzes.flatMap(q => (q.participants || []).filter(p => p.student && p.student.equals(s._id)).map(p => p.score)).filter(sc => typeof sc === 'number');
        return {
          ...s.toObject(),
          nbCourses: studentCourses.length,
          nbQuizzes: studentQuizzes.length,
          avgQuizScore: quizScores.length ? (quizScores.reduce((a, b) => a + b, 0) / quizScores.length).toFixed(2) : '',
        };
      });
      if (format === 'CSV') {
        const fields = [
          { label: 'Prénom', value: 'firstName' },
          { label: 'Nom', value: 'lastName' },
          { label: 'Email', value: 'email' },
          { label: 'Cours suivis', value: 'nbCourses' },
          { label: 'Quiz passés', value: 'nbQuizzes' },
          { label: 'Moyenne Quiz', value: 'avgQuizScore' },
          { label: 'Dernière connexion', value: row => row.lastLogin ? new Date(row.lastLogin).toLocaleDateString() : '' }
        ];
        const parser = new Parser({ fields });
        const csv = parser.parse(studentStats);
        const filePath = path.join(reportsDir, name + '.csv');
        fs.writeFileSync(filePath, csv);
        fileUrl = '/uploads/reports/' + name + '.csv';
      } else if (format === 'PDF') {
        const filePath = path.join(reportsDir, name + '.pdf');
        const doc = new PDFDocument({ margin: 30 });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);
        doc.fontSize(18).text('Rapport: Engagement des Étudiants', { align: 'center' });
        doc.moveDown();
        studentStats.forEach(s => {
          doc.fontSize(12).text(`Nom: ${s.firstName} ${s.lastName}`);
          doc.text(`Email: ${s.email}`);
          doc.text(`Cours suivis: ${s.nbCourses}`);
          doc.text(`Quiz passés: ${s.nbQuizzes}`);
          doc.text(`Moyenne Quiz: ${s.avgQuizScore}`);
          doc.text(`Dernière connexion: ${s.lastLogin ? new Date(s.lastLogin).toLocaleDateString() : ''}`);
          doc.moveDown();
        });
        doc.end();
        await new Promise(resolve => stream.on('finish', resolve));
        fileUrl = '/uploads/reports/' + name + '.pdf';
      } else if (format === 'Excel') {
        const filePath = path.join(reportsDir, name + '.xlsx');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Étudiants');
        sheet.columns = [
          { header: 'Prénom', key: 'firstName' },
          { header: 'Nom', key: 'lastName' },
          { header: 'Email', key: 'email' },
          { header: 'Cours suivis', key: 'nbCourses' },
          { header: 'Quiz passés', key: 'nbQuizzes' },
          { header: 'Moyenne Quiz', key: 'avgQuizScore' },
          { header: 'Dernière connexion', key: 'lastLogin' }
        ];
        studentStats.forEach(s => {
          sheet.addRow({
            firstName: s.firstName,
            lastName: s.lastName,
            email: s.email,
            nbCourses: s.nbCourses,
            nbQuizzes: s.nbQuizzes,
            avgQuizScore: s.avgQuizScore,
            lastLogin: s.lastLogin ? new Date(s.lastLogin).toLocaleDateString() : ''
          });
        });
        await workbook.xlsx.writeFile(filePath);
        fileUrl = '/uploads/reports/' + name + '.xlsx';
      }
    }
    // Course Enrollments Reports
    else if (type === 'Inscriptions aux Cours') {
      const courseQuery = dateFilter.$gte ? { createdAt: dateFilter } : {};
      const courses = await Course.find(courseQuery).populate('instructor').populate('students.studentId');
      const rows = courses.map(c => ({
        course: c.title,
        instructor: c.instructor ? c.instructor.firstName + ' ' + c.instructor.lastName : '',
        enrolled: c.students.length
      }));
      if (format === 'CSV') {
        const fields = [
          { label: 'Cours', value: 'course' },
          { label: 'Formateur', value: 'instructor' },
          { label: 'Nombre d\'inscrits', value: 'enrolled' }
        ];
        const parser = new Parser({ fields });
        const csv = parser.parse(rows);
        const filePath = path.join(reportsDir, name + '.csv');
        fs.writeFileSync(filePath, csv);
        fileUrl = '/uploads/reports/' + name + '.csv';
      } else if (format === 'PDF') {
        const filePath = path.join(reportsDir, name + '.pdf');
        const doc = new PDFDocument();
        doc.pipe(fs.createWriteStream(filePath));
        doc.fontSize(18).text('Rapport: Inscriptions aux Cours', { align: 'center' });
        doc.moveDown();
        rows.forEach(r => {
          doc.fontSize(12).text(`Cours: ${r.course}`);
          doc.text(`Formateur: ${r.instructor}`);
          doc.text(`Nombre d'inscrits: ${r.enrolled}`);
          doc.moveDown();
        });
        doc.end();
        fileUrl = '/uploads/reports/' + name + '.pdf';
      } else if (format === 'Excel') {
        const filePath = path.join(reportsDir, name + '.xlsx');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Cours');
        sheet.columns = [
          { header: 'Cours', key: 'course' },
          { header: 'Formateur', key: 'instructor' },
          { header: 'Nombre d\'inscrits', key: 'enrolled' }
        ];
        rows.forEach(r => sheet.addRow(r));
        await workbook.xlsx.writeFile(filePath);
        fileUrl = '/uploads/reports/' + name + '.xlsx';
      }
    }
    // Quiz Results Reports
    else if (type === 'Résultats des Quiz') {
      const quizQuery = dateFilter.$gte ? { createdAt: dateFilter } : {};
      const quizzes = await Quiz.find(quizQuery).populate('instructor').populate('participants.student');
      const rows = quizzes.map(q => ({
        quiz: q.title,
        instructor: q.instructor ? q.instructor.firstName + ' ' + q.instructor.lastName : '',
        participants: q.participants ? q.participants.length : 0
      }));
      if (format === 'CSV') {
        const fields = [
          { label: 'Quiz', value: 'quiz' },
          { label: 'Formateur', value: 'instructor' },
          { label: 'Nombre de participants', value: 'participants' }
        ];
        const parser = new Parser({ fields });
        const csv = parser.parse(rows);
        const filePath = path.join(reportsDir, name + '.csv');
        fs.writeFileSync(filePath, csv);
        fileUrl = '/uploads/reports/' + name + '.csv';
      } else if (format === 'PDF') {
        const filePath = path.join(reportsDir, name + '.pdf');
        const doc = new PDFDocument();
        doc.pipe(fs.createWriteStream(filePath));
        doc.fontSize(18).text('Rapport: Résultats des Quiz', { align: 'center' });
        doc.moveDown();
        rows.forEach(r => {
          doc.fontSize(12).text(`Quiz: ${r.quiz}`);
          doc.text(`Formateur: ${r.instructor}`);
          doc.text(`Nombre de participants: ${r.participants}`);
          doc.moveDown();
        });
        doc.end();
        fileUrl = '/uploads/reports/' + name + '.pdf';
      } else if (format === 'Excel') {
        const filePath = path.join(reportsDir, name + '.xlsx');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Quiz');
        sheet.columns = [
          { header: 'Quiz', key: 'quiz' },
          { header: 'Formateur', key: 'instructor' },
          { header: 'Nombre de participants', key: 'participants' }
        ];
        rows.forEach(r => sheet.addRow(r));
        await workbook.xlsx.writeFile(filePath);
        fileUrl = '/uploads/reports/' + name + '.xlsx';
      }
    }
    // Fallback for other types
    if (!fileUrl) {
      fileUrl = '/uploads/reports/' + name + '.' + format.toLowerCase();
    }
    const report = await Report.create({
      name,
      type,
      format,
      generatedBy,
      fileUrl,
      status
    });
    res.status(201).json(report);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete a report
// @route   DELETE /api/admin/reports/:id
// @access  Private/Admin
const deleteReport = async (req, res) => {
  try {
    await Report.findByIdAndDelete(req.params.id);
    res.json({ message: 'Report deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all scheduled reports
// @route   GET /api/admin/scheduled-reports
// @access  Private/Admin
const getScheduledReports = async (req, res) => {
  try {
    const scheduled = await ScheduledReport.find().sort({ nextRun: 1 });
    res.json(scheduled);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a scheduled report
// @route   POST /api/admin/scheduled-reports
// @access  Private/Admin
const createScheduledReport = async (req, res) => {
  try {
    const { name, type, frequency, nextRun, recipients, format } = req.body;
    const createdBy = req.user ? req.user.firstName + ' ' + req.user.lastName : 'Admin';
    const scheduled = await ScheduledReport.create({
      name,
      type,
      frequency,
      nextRun,
      recipients,
      format,
      createdBy
    });
    res.status(201).json(scheduled);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete a scheduled report
// @route   DELETE /api/admin/scheduled-reports/:id
// @access  Private/Admin
const deleteScheduledReport = async (req, res) => {
  try {
    await ScheduledReport.findByIdAndDelete(req.params.id);
    res.json({ message: 'Scheduled report deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
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
};
