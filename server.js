const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const multer = require('multer');
const authenticateUser = require('./middleware/auth.js');
const { logout } = require('./middleware/auth');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const ScheduledReport = require('./models/ScheduledReport');
const Report = require('./models/Report');
const fs = require('fs');
const { generateReportFile } = require('./utils/helperFunctions');

require('dotenv').config();

mongoose.set('strictQuery', false);

// Routes
const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const studentRoutes = require('./routes/studentRoutes');
const teacherRoutes = require('./routes/profRoutes');
const groupRoutes = require('./routes/groupRoutes');
const conferenceRoutes = require('./routes/conferenceRoutes');
const eventRoutes = require('./routes/eventRoutes');
const forumRoutes = require('./routes/forum');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: true,
    credentials: true
  }
});

const PORT = process.env.PORT || 3000;

// Configure file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/profile-photos/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  exposedHeaders: ['set-cookie']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: 'mongodb://127.0.0.1:27017/eduflex',
    ttl: 24 * 60 * 60, // 1 day
    autoRemove: 'native'
  }),
  cookie: {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));

// Add the missing auth check endpoint
app.get('/api/auth/check', (req, res) => {
  if (req.session.user) {
    res.json({ 
      success: true, 
      authenticated: true,
      userId: req.session.user._id,
      userType: req.session.user.role
    });
  } else {
    res.status(401).json({ 
      success: false, 
      authenticated: false 
    });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', authenticateUser, courseRoutes);
app.use('/api/groups', authenticateUser, groupRoutes);
app.use('/api/conferences', authenticateUser, conferenceRoutes);
app.use('/api/events', authenticateUser, eventRoutes);
app.use('/api/forum', authenticateUser, forumRoutes);

// Mount student routes at both paths for compatibility
app.use('/api/student', authenticateUser, studentRoutes);
app.use('/api/students', authenticateUser, studentRoutes);

// Mount teacher routes with both paths for compatibility
app.use('/api/teacher', authenticateUser, teacherRoutes);
app.use('/api/teachers', authenticateUser, teacherRoutes); // Add this line to match frontend expectations

// Mount admin routes
app.use('/api/admin', adminRoutes);

// Socket.IO handling
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('join-room', ({ roomId, userId, username, isTeacher }) => {
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add({ userId, username, isTeacher, socketId: socket.id });

    // Notify others in the room
    socket.to(roomId).emit('user-connected', { userId, username, isTeacher });

    // Send list of connected users to the new participant
    const participants = Array.from(rooms.get(roomId));
    socket.emit('room-users', participants);
  });

  socket.on('signal', ({ userId, signal }) => {
    socket.broadcast.emit('user-signal', { userId, signal });
  });

  socket.on('disconnect', () => {
    // Find and remove user from all rooms
    rooms.forEach((users, roomId) => {
      const user = Array.from(users).find(u => u.socketId === socket.id);
      if (user) {
        users.delete(user);
        socket.to(roomId).emit('user-disconnected', user.userId);
        
        // If room is empty, delete it
        if (users.size === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
});

// === SCHEDULED REPORT EMAIL SENDER ===

// Setup nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Helper to get next run date based on frequency
function getNextRun(current, frequency) {
  const d = new Date(current);
  if (frequency === 'Quotidien') d.setDate(d.getDate() + 1);
  else if (frequency === 'Hebdomadaire') d.setDate(d.getDate() + 7);
  else if (frequency === 'Mensuel') d.setMonth(d.getMonth() + 1);
  else if (frequency === 'Trimestriel') d.setMonth(d.getMonth() + 3);
  return d;
}

// Helper to wait for file existence
const waitForFile = async (filePath, retries = 5, delay = 200) => {
  for (let i = 0; i < retries; i++) {
    if (fs.existsSync(filePath)) return true;
    await new Promise(res => setTimeout(res, delay));
  }
  return false;
};

// Cron job: every minute
cron.schedule('* * * * *', async () => {
  try {
    console.log('[CRON] Checking for scheduled reports...');
    const now = new Date();
    const dueReports = await ScheduledReport.find({ nextRun: { $lte: now } });
    console.log('[CRON] Due reports found:', dueReports.length);
    for (const scheduled of dueReports) {
      console.log('[CRON] ScheduledReport:', {
        name: scheduled.name,
        type: scheduled.type,
        format: scheduled.format
      });
      // Find all matching reports for debug
      const allReports = await Report.find({
        name: scheduled.name
      });
      console.log('[CRON] All Report docs with this name:', allReports.map(r => ({ name: r.name, type: r.type, format: r.format, fileUrl: r.fileUrl })));
      // Find the latest generated report file for this report name/type/format
      let report = await Report.findOne({
        name: scheduled.name,
        type: scheduled.type,
        format: scheduled.format
      }).sort({ createdAt: -1 });
      if (!report || !report.fileUrl) {
        console.log('[CRON] No report file found for', scheduled.name, '- generating now...');
        // Try to generate the report file
        try {
          report = await generateReportFile({
            name: scheduled.name,
            type: scheduled.type,
            format: scheduled.format,
            period: scheduled.frequency, // You may want to adjust this if period is not the same as frequency
            generatedBy: scheduled.createdBy || 'System'
          });
          console.log('[CRON] Report generated:', report.fileUrl);
        } catch (genErr) {
          console.error('[CRON] Error generating report:', genErr);
          continue;
        }
      }
      const filePath = path.join(__dirname, 'public', report.fileUrl);
      // Wait for file to exist (fix race condition)
      const fileReady = await waitForFile(filePath, 10, 300);
      if (!fileReady) {
        console.log('[CRON] File still does not exist after waiting:', filePath);
        continue;
      }
      // Send email to all recipients
      for (const email of scheduled.recipients) {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: email,
          subject: `Rapport programmé: ${scheduled.name}`,
          text: `Veuillez trouver ci-joint le rapport programmé (${scheduled.name}).`,
          attachments: [
            {
              filename: path.basename(filePath),
              path: filePath
            }
          ]
        });
        console.log(`[CRON] Scheduled report sent to ${email}: ${filePath}`);
      }
      // Update nextRun
      scheduled.nextRun = getNextRun(scheduled.nextRun, scheduled.frequency);
      await scheduled.save();
    }
  } catch (err) {
    console.error('[CRON] Scheduled report email error:', err);
  }
});

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/eduflex')
  .then(() => {
    console.log('Connected to MongoDB');
    httpServer.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });

module.exports = app;