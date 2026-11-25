const { randomUUID } = require('node:crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { publicUser, requireAuth } = require('../middleware/require-auth');
const { addUser, readUsers } = require('../services/user-store');
const { validateLogin, validateRegistration } = require('../validation/auth');

const authRouter = express.Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Se alcanzó el límite de intentos. Esperá unos minutos y volvé a intentar.' }
});

function requireJson(req, res, next) {
  if (!req.is('application/json')) {
    return res.status(415).json({ message: 'La solicitud debe enviarse en formato JSON.' });
  }
  return next();
}

function createSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error);
      req.session.userId = user.id;
      req.session.save((saveError) => saveError ? reject(saveError) : resolve());
    });
  });
}

function validationError(errors) {
  return Object.values(errors)[0];
}

authRouter.post('/register', requireJson, async (req, res, next) => {
  const { values, errors } = validateRegistration(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ message: validationError(errors), errors });

  try {
    const passwordHash = await bcrypt.hash(values.password, 12);
    const user = {
      id: randomUUID(),
      nombre: values.nombre,
      email: values.email,
      telefono: values.telefono,
      passwordHash,
      role: 'cliente',
      createdAt: new Date().toISOString()
    };
    await addUser(user);
    await createSession(req, user);
    return res.status(201).json({ message: 'Tu cuenta fue creada correctamente.', user: publicUser(user) });
  } catch (error) {
    if (error.code === 'USER_CONFLICT') return res.status(409).json({ message: error.message });
    return next(error);
  }
});

authRouter.post('/login', loginLimiter, requireJson, async (req, res, next) => {
  const { values, errors } = validateLogin(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ message: validationError(errors), errors });

  try {
    const users = await readUsers();
    const user = users.find((item) => item.email === values.email);
    const matches = user ? await bcrypt.compare(values.password, user.passwordHash) : false;
    if (!matches) return res.status(401).json({ message: 'Correo o contraseña incorrectos.' });
    await createSession(req, user);
    return res.json({ message: 'Sesión iniciada correctamente.', user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

authRouter.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

authRouter.post('/logout', (req, res, next) => {
  if (!req.session) {
    res.clearCookie('motorfix.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return res.status(204).end();
  }
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('motorfix.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return res.status(204).end();
  });
});

module.exports = { authRouter };
