const path = require('node:path');
const express = require('express');
const session = require('express-session');
const FileStoreFactory = require('session-file-store');
const { appointmentsRouter } = require('./src/routes/appointments');
const { authRouter } = require('./src/routes/auth');
const { ensureAppointmentStore } = require('./src/services/appointment-store');
const { ensureUserStore, readUsers } = require('./src/services/user-store');

const app = express();
const port = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET;
const FileStore = FileStoreFactory(session);

if (!sessionSecret && isProduction) {
  throw new Error('SESSION_SECRET es obligatorio en producción.');
}

if (!sessionSecret) {
  console.warn('SESSION_SECRET no está definido; se usará un secreto temporal de desarrollo.');
}

app.disable('x-powered-by');
app.use(express.json({ limit: '10kb', type: 'application/json' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

app.use(session({
  store: new FileStore({
    path: path.join(__dirname, 'data', 'sessions'),
    ttl: 8 * 60 * 60,
    reapInterval: 60 * 60,
    retries: 0
  }),
  name: 'motorfix.sid',
  secret: sessionSecret || 'motorfix-development-secret-change-before-deploying',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use('/api/auth', authRouter);
app.use('/api/appointments', appointmentsRouter);
app.get('/pages/pagina3.html', (req, res, next) => {
  if (!req.session?.userId) {
    return res.redirect('/pages/pagina1.html');
  }
  return readUsers().then((users) => {
    const user = users.find((item) => item.id === req.session.userId);
    if (!user || user.role !== 'cliente') return res.redirect(user?.role === 'jefe-taller' ? '/pages/panel-jefe.html' : user?.role === 'mecanico' ? '/pages/panel-mecanico.html' : '/pages/pagina1.html');
    return res.sendFile(path.join(__dirname, 'pages', 'pagina3.html'), (error) => error && next(error));
  }).catch(next);
});
app.get('/pages/panel-jefe.html', (req, res, next) => {
  if (!req.session?.userId) return res.redirect('/pages/pagina1.html');
  return readUsers().then((users) => {
    const user = users.find((item) => item.id === req.session.userId);
    if (user?.role !== 'jefe-taller') return res.redirect(user?.role === 'mecanico' ? '/pages/panel-mecanico.html' : '/pages/pagina3.html');
    return res.sendFile(path.join(__dirname, 'pages', 'panel-jefe.html'), (error) => error && next(error));
  }).catch(next);
});
app.get('/pages/panel-mecanico.html', (req, res, next) => {
  if (!req.session?.userId) return res.redirect('/pages/pagina1.html');
  return readUsers().then((users) => {
    const user = users.find((item) => item.id === req.session.userId);
    if (user?.role !== 'mecanico') {
      const destination = ({ 'jefe-taller': 'panel-jefe.html', cliente: 'panel-usuario.html' })[user?.role] || 'pagina1.html';
      return res.redirect(`/pages/${destination}`);
    }
    return res.sendFile(path.join(__dirname, 'pages', 'panel-mecanico.html'), (error) => error && next(error));
  }).catch(next);
});
app.get('/pages/panel-usuario.html', (req, res, next) => {
  if (!req.session?.userId) return res.redirect('/pages/pagina1.html');
  return readUsers().then((users) => {
    const user = users.find((item) => item.id === req.session.userId);
    if (user?.role !== 'cliente') return res.redirect(user?.role === 'jefe-taller' ? '/pages/panel-jefe.html' : user?.role === 'mecanico' ? '/pages/panel-mecanico.html' : '/pages/pagina1.html');
    return res.sendFile(path.join(__dirname, 'pages', 'panel-usuario.html'), (error) => error && next(error));
  }).catch(next);
});

app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.use('/css', express.static(path.join(__dirname, 'css'), { fallthrough: false }));
app.use('/images', express.static(path.join(__dirname, 'images'), { fallthrough: false }));
app.use('/js', express.static(path.join(__dirname, 'js'), { fallthrough: false }));
app.use('/pages', express.static(path.join(__dirname, 'pages'), { fallthrough: false }));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.status === 404) return res.status(404).json({ message: 'No se encontró el recurso solicitado.' });
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'La solicitud es demasiado grande.' });
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ message: 'El formato de la solicitud no es válido.' });
  }
  console.error('Error inesperado en el servidor:', error);
  return res.status(500).json({ message: 'Ocurrió un error inesperado. Intentá nuevamente.' });
});

Promise.all([ensureUserStore(), ensureAppointmentStore()])
  .then(() => app.listen(port, () => {
    console.log(`MotorFix disponible en http://localhost:${port}`);
  }))
  .catch((error) => {
    console.error('No se pudo inicializar el almacenamiento de usuarios:', error);
    process.exitCode = 1;
  });
