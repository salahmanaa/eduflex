exports.login = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    
    if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    req.session.user = {
      id: user._id,
      role: user.role,
      email: user.email
    };

    res.json({
      redirect:
        user.role === 'admin'
          ? '/admin/admin-dashboard.html'
          : user.role === 'teacher'
          ? '/prof/profile.html'
          : '/student/profile.html'
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};