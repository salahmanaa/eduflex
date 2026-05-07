// middlewares/roleMiddleware.js
module.exports = (role) => (req, res, next) => {
  if (req.session.user?.role === role) next();
  else res.status(403).json({ error: 'Accès non autorisé' });
};