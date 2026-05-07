const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Connexion
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log('Login attempt for:', email);

    // 1. Validation des entrées
    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe requis" });
    }

    // 2. Recherche de l'utilisateur
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      console.log('Login failed: User not found');
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    // 3. Vérification du mot de passe
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.log('Login failed: Invalid password');
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    // 4. Création de la session
    req.session.user = {
      _id: user._id.toString(),
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName
    };
    
    // Set userId and userType for backward compatibility
    req.session.userId = user._id.toString();
    req.session.userType = user.role;

    console.log('Session created:', req.session);

    // 5. Sauvegarde explicite de la session
    await new Promise((resolve, reject) => {
      req.session.save(err => {
        if (err) {
          console.error('Session save error:', err);
          reject(err);
        } else {
          console.log('Session saved successfully');
          resolve();
        }
      });
    });

    // 6. Réponse avec redirection
    const redirectUrl =
      user.role === 'admin'
        ? '/admin/admin-dashboard.html'
        : user.role === 'teacher'
        ? '/teacher/mes-cours.html'
        : '/student/profile.html';

    console.log('Login successful, redirecting to:', redirectUrl);

    res.json({
      message: "Connexion réussie",
      redirect: redirectUrl,
      user: req.session.user
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: "Erreur lors de la connexion" });
  }
});

// Déconnexion
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ error: "Échec de la déconnexion" });
    }
    res.clearCookie("connect.sid", {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    res.json({ message: "Déconnexion réussie" });
  });
});

// Vérification de session
router.get('/session', (req, res) => {
  console.log('Session check - Current session:', req.session);
  if (!req.session.userId) {
    return res.status(401).json({ isLoggedIn: false });
  }
  res.json({
    isLoggedIn: true,
    user: {
      _id: req.session.userId,
      role: req.session.userType
    }
  });
});

// Get user profile
router.get('/me', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const user = await User.findById(req.session.userId)
      .select('-password -__v');

    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    res.json({
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || '',
      birthDate: user.birthDate || null,
      profilePhoto: user.profilePhoto || 'https://placehold.co/200x200?text=' + user.firstName.charAt(0),
      role: user.role
    });

  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Update user profile info (firstName, lastName, email, phone, birthDate)
router.put('/me', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    const { firstName, lastName, email, phone, birthDate } = req.body;
    const update = { firstName, lastName, email, phone, birthDate };
    const user = await User.findByIdAndUpdate(req.session.userId, update, { new: true, runValidators: true }).select('-password -__v');
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    res.json({ message: 'Profil mis à jour', user });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Change user password
router.post('/change-password', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await User.findByIdAndUpdate(req.session.userId, { password: hashedPassword });
    res.json({ message: 'Mot de passe changé' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Upload user profile photo
const uploadDir = path.join(__dirname, '../public/uploads/users/profile-photos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `user-${req.session.userId}-${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers image sont autorisés.'), false);
    }
  }
});
router.post('/users/upload-photo', upload.single('profilePhoto'), async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier téléchargé' });
    }
    const photoUrl = `/uploads/users/profile-photos/${req.file.filename}`;
    await User.findByIdAndUpdate(req.session.userId, { profilePhoto: photoUrl });
    res.json({ message: 'Photo de profil mise à jour', photoUrl });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Signup route
router.post('/signup', async (req, res) => {
  const { firstName, lastName, email, password, role = 'student' } = req.body;

  try {
    console.log('Signup attempt for:', email);

    // 1. Validate input
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: "Tous les champs sont requis" });
    }

    // 2. Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ error: "Cet email est déjà utilisé" });
    }

    // 3. Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Create new user
    const newUser = new User({
      firstName,
      lastName,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role
    });

    await newUser.save();
    console.log('New user created:', newUser._id);

    // 5. Create session
    req.session.userId = newUser._id.toString();
    req.session.userType = newUser.role;

    console.log('Session created for new user:', req.session);

    // 6. Save session
    await new Promise((resolve, reject) => {
      req.session.save(err => {
        if (err) {
          console.error('Session save error:', err);
          reject(err);
        } else {
          console.log('Session saved successfully');
          resolve();
        }
      });
    });

    // 7. Send response
    res.status(201).json({
      message: "Inscription réussie",
      redirect: role === 'teacher' ? '/teacher/mes-cours.html' : '/student/profile.html',
      user: {
        _id: newUser._id.toString(),
        email: newUser.email,
        role: newUser.role,
        firstName: newUser.firstName,
        lastName: newUser.lastName
      }
    });

  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Erreur serveur lors de l'inscription" });
  }
});

module.exports = router;