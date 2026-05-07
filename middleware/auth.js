const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    // Debug logging
    console.log('Auth middleware - Session:', req.session);
    console.log('Auth middleware - Session user:', req.session?.user);

    // Check if session exists and has user
    if (!req.session || !req.session.user) {
      console.log('Auth middleware - No session or user');
      return res.status(401).json({ error: "Non connecté" });
    }

    // Verify user still exists in database
    const user = await User.findById(req.session.user._id);
    if (!user) {
      console.log('Auth middleware - User not found in database');
      // Clear invalid session
      req.session.destroy();
      return res.status(401).json({ error: "Session invalide" });
    }

    console.log('Auth middleware - User authenticated:', user.email);
    
    // Attach fresh user data to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: "Erreur d'authentification" });
  }
};

// Add logout route handler
module.exports.logout = (req, res) => {
  // Debug: Log session before destruction
  console.log('Pre-logout session:', req.session);
  
  req.session.destroy(err => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).json({ 
        success: false, 
        error: 'Could not destroy session',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    
    // Clear cookie with exact same options as session
    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    console.log('Post-logout: Session destroyed and cookie cleared');
    return res.json({ 
      success: true, 
      message: "Déconnexion réussie" 
    });
  });
};