const { readUsers } = require('../services/user-store');

function publicUser(user) {
  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    role: user.role
  };
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: 'Necesitás iniciar sesión para continuar.' });
  }
  readUsers()
    .then((users) => {
      const user = users.find((item) => item.id === req.session.userId);
      if (!user) return res.status(401).json({ message: 'La sesión no es válida. Iniciá sesión nuevamente.' });
      req.user = publicUser(user);
      return next();
    })
    .catch(next);
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'No tenés permisos para acceder a esta función.' });
    }
    return next();
  };
}

module.exports = { publicUser, requireAuth, requireRole };
