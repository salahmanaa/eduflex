# EDUFLEX - Learning Management System (LMS)

A comprehensive educational platform built with Node.js, Express, and MongoDB. EDUFLEX is a full-stack LMS designed to facilitate online education with role-based access control, real-time communication, and advanced course management features.

## 🌟 Features

### User Management

- **Three Role Types**: Student, Teacher (Professor), Admin
- **User Profiles**: Profile photos, contact information, birth dates
- **Session-based Authentication**: Secure login with bcrypt password hashing
- **MongoDB Session Store**: Persistent sessions across server restarts

### Course Management

- **Course Creation & Organization**: Instructors can create and manage courses
- **Rich Content Types**: Text, PDF, Videos, Quizzes
- **Course Categories**:
  - Intelligence Artificielle (AI)
  - Développement Web (Web Development)
  - Data Science
  - Marketing Digital
  - Cybersécurité (Cybersecurity)
  - Mobile
  - Base de données (Database)
- **Difficulty Levels**: Beginner, Intermediate, Advanced, Expert
- **Course Content**: Structured learning paths with ordered content items

### Assessments & Evaluation

- **Quizzes**: Time-limited assessments with customizable settings
  - Multiple questions per quiz
  - Question shuffling option
  - Score tracking and reporting
  - Participant management
- **Assignments (Devoirs)**: File-based assignments with submission tracking
- **Quiz Attempts**: Detailed tracking of student responses and scores
- **Question Bank**: Centralized question management with answer keys

### Collaboration & Communication

- **Discussion Forums**: Threaded discussions with comments
- **Direct Messaging**: Private communication between users
- **Study Groups**: Collaborative learning groups
- **Events**: Schedulable platform events
- **Video Conferencing**: WebRTC-based video calls using Peer.js

### Administrative Dashboard

- **Analytics**: Student progress tracking and platform usage metrics
- **User Management**: Manage students, teachers, and administrators
- **Report Generation**: Create and schedule automated reports
  - Daily, Weekly, Monthly, Quarterly options
  - PDF/Excel export
  - Email delivery via SMTP
- **System Settings**: Configure platform parameters
- **Content Moderation**: Forum and content management

### Real-time Features

- **Socket.IO Integration**: Live notifications and messaging
- **Video Conference Management**: Room-based video communication
- **Instant Updates**: Real-time status changes across the platform

## 🛠️ Tech Stack

### Backend

- **Framework**: Express.js 4.18.3
- **Runtime**: Node.js
- **Database**: MongoDB 8.2.0 with Mongoose ODM
- **Authentication**: bcrypt 5.1.1 for password hashing
- **Session Management**: express-session with connect-mongo

### Real-time Communication

- **WebSocket**: Socket.IO 4.7.4
- **Video Conferencing**: Peer.js 1.0.2 (WebRTC)

### File Management

- **Upload Handler**: Multer 1.4.5
- **File Generation**:
  - PDFKit 0.17.1 (PDF generation)
  - ExcelJS 4.4.0 (Excel spreadsheets)
  - json2csv 6.0.0-alpha.2 (CSV export)

### Email & Scheduling

- **Email Service**: Nodemailer 6.9.8
- **Task Scheduling**: node-cron 3.0.3
- **CORS**: CORS 2.8.5
- **Environment Config**: dotenv 16.4.5

### Development

- **Concurrent Tasks**: concurrently 8.2.2 (dev scripts)

## 📋 Project Structure

```
├── server.js                 # Main Express server
├── peerServer.js             # Peer.js WebRTC server
├── package.json              # Dependencies
├── config/
│   └── db.js                 # MongoDB configuration
├── models/                   # Mongoose schemas
│   ├── User.js
│   ├── Course.js
│   ├── Quiz.js
│   ├── Devoir.js
│   ├── Message.js
│   ├── Conference.js
│   ├── Event.js
│   ├── Group.js
│   └── ...more models
├── controllers/              # Business logic
│   ├── authController.js
│   ├── courseController.js
│   ├── studentController.js
│   ├── profController.js
│   ├── adminController.js
│   └── ...more controllers
├── routes/                   # API routes
│   ├── auth.js
│   ├── courses.js
│   ├── studentRoutes.js
│   ├── profRoutes.js
│   ├── adminRoutes.js
│   └── ...more routes
├── middleware/               # Custom middleware
│   ├── auth.js
│   ├── authMiddleware.js
│   └── roleMiddleware.js
├── public/                   # Static files
│   ├── uploads/              # User uploads
│   └── js/
├── student/                  # Student UI pages
├── teacher/                  # Teacher UI pages
├── admin/                    # Admin UI pages
├── assets/                   # Shared CSS and JS
└── utils/                    # Helper functions
```

## 🚀 Installation

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (v5 or higher)
- npm or yarn

### Setup Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/salahmanaa/eduflex.git
   cd eduflex/66
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the root directory:

   ```env
   PORT=3000
   MONGODB_URI=mongodb://127.0.0.1:27017/eduflex
   SESSION_SECRET=your-secret-key
   NODE_ENV=development

   # SMTP Configuration (for email reports)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

4. **Start MongoDB**

   ```bash
   mongod
   ```

5. **Run the application**

   **Development mode** (runs both server and Peer server concurrently):

   ```bash
   npm run dev
   ```

   **Production mode**:

   ```bash
   npm start
   ```

   **Peer server only**:

   ```bash
   npm run peer
   ```

6. **Access the application**
   - Open your browser and navigate to `http://localhost:3000`

## 📚 API Endpoints

### Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `GET /api/auth/check` - Check authentication status

### Courses

- `GET /api/courses` - Get all courses
- `POST /api/courses` - Create new course
- `GET /api/courses/:id` - Get course details
- `PUT /api/courses/:id` - Update course
- `DELETE /api/courses/:id` - Delete course

### Students

- `GET /api/students/dashboard` - Student dashboard data
- `GET /api/students/my-courses` - Enrolled courses
- `POST /api/students/enroll` - Enroll in course

### Teachers

- `GET /api/teachers/dashboard` - Teacher dashboard data
- `GET /api/teachers/my-courses` - Created courses
- `POST /api/teachers/quiz` - Create quiz
- `POST /api/teachers/devoir` - Create assignment

### Admin

- `GET /api/admin/analytics` - Platform analytics
- `GET /api/admin/users` - All users
- `POST /api/admin/reports` - Generate reports
- `POST /api/admin/scheduled-reports` - Schedule report delivery

### Forum

- `GET /api/forum/discussions` - Get discussions
- `POST /api/forum/discussions` - Create discussion
- `POST /api/forum/comments` - Add comment

### Conferences

- `POST /api/conferences/create` - Create conference room
- `GET /api/conferences/:id` - Get conference details

### Events

- `GET /api/events` - Get all events
- `POST /api/events` - Create event
- `PUT /api/events/:id` - Update event

## 🔐 User Roles & Permissions

### Student Role

- View enrolled courses
- Submit assignments
- Take quizzes
- Participate in forums
- Join study groups
- Access video conferences
- View messages

### Teacher Role

- Create and manage courses
- Create quizzes and assignments
- Grade submissions and quizzes
- Access student progress reports
- Create events
- Moderate discussions
- View class statistics

### Admin Role

- Full platform access
- User management
- Report generation and scheduling
- System configuration
- Content moderation
- Analytics and statistics
- User role assignment

## 🗄️ Database Models

### Core Models

- **User**: User account information and roles
- **Course**: Course details, content, and metadata
- **Quiz**: Quiz definitions and questions
- **Question**: Individual quiz questions
- **QuizAttempt**: Student quiz responses and scores
- **Devoir**: Assignment details
- **DevoirSubmission**: Student assignment submissions
- **Message**: Direct messages between users
- **Discussion**: Forum discussion threads
- **Comment**: Forum comments
- **Conference**: Video conference sessions
- **Event**: Platform events
- **Group**: Study groups
- **Report**: Generated reports
- **ScheduledReport**: Automated report schedules

## 📧 Email Reporting

EDUFLEX supports automated report generation and email delivery:

- **Frequencies**: Daily, Weekly, Monthly, Quarterly
- **Formats**: PDF and Excel
- **Recipients**: Configurable email addresses
- **Scheduling**: Cron-based task scheduler
- **Content**: Customizable report types

## 🎯 Getting Started

### For Students

1. Register or login
2. Browse and enroll in courses
3. Access course materials
4. Complete assignments and quizzes
5. Participate in discussions
6. Connect with other students

### For Teachers

1. Login to dashboard
2. Create courses
3. Upload course content
4. Create quizzes and assignments
5. Monitor student progress
6. Generate reports
7. Moderate discussions

### For Administrators

1. Access admin dashboard
2. Manage users and roles
3. Configure system settings
4. Generate analytics and reports
5. Schedule automated reports
6. Monitor platform activity

## 🔒 Security Features

- **Password Hashing**: bcrypt with salt rounds
- **Session Security**: HTTPOnly cookies, SameSite protection
- **CORS Configuration**: Restricted cross-origin access
- **Authentication Middleware**: Protected routes
- **Role-based Access Control**: Granular permission management
- **File Upload Validation**: MIME type checking, size limits (5MB)
- **Input Validation**: Data sanitization and validation

## 📱 Supported Devices

- Desktop browsers (Chrome, Firefox, Safari, Edge)
- Tablet devices
- Mobile devices (responsive design)
- Video conferencing: Desktop/Laptop recommended

## 🐛 Troubleshooting

### MongoDB Connection Issues

- Ensure MongoDB is running: `mongod`
- Check connection string in `.env`
- Verify MongoDB service status

### Session Issues

- Clear browser cookies
- Restart the server
- Check MongoDB session store

### File Upload Issues

- Verify `/public/uploads/` directory exists
- Check file size limits (5MB max)
- Ensure proper MIME types (images only for profile photos)

### Video Conference Issues

- Check WebRTC compatibility
- Ensure proper network connectivity
- Verify Peer.js server is running

## 📝 Environment Variables Reference

```env
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://127.0.0.1:27017/eduflex

# Session
SESSION_SECRET=your-secret-key

# Email/SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

## 📄 License

This project is licensed under the ISC License.

## 👨‍💼 Support

For support, please open an issue on the GitHub repository or contact the development team.

---

**EDUFLEX** - Empowering Education Through Technology 🎓
