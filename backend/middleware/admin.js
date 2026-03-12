// Must be used AFTER the auth middleware (req.user already set)
module.exports = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: 'Accès refusé — droits administrateur requis.' });
  }
  next();
};
