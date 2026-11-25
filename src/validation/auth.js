function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value) {
  return cleanString(value).toLowerCase();
}

function validateRegistration(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};
  const nombre = cleanString(body.nombre);
  const email = normalizeEmail(body.email);
  const telefono = cleanString(body.telefono);
  const password = typeof body.password === 'string' ? body.password : '';
  const errors = {};

  if (nombre.length < 2 || nombre.length > 100) errors.nombre = 'Ingresá tu nombre y apellido (2 a 100 caracteres).';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Ingresá un correo electrónico válido.';
  if (telefono.length < 6 || telefono.length > 30) errors.telefono = 'Ingresá un teléfono válido.';
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) errors.password = 'La contraseña debe tener al menos 8 caracteres y no superar 72 bytes.';

  return { values: { nombre, email, telefono, password }, errors };
}

function validateLogin(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const errors = {};
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Ingresá un correo electrónico válido.';
  if (!password || Buffer.byteLength(password, 'utf8') > 72) errors.password = 'Ingresá una contraseña válida.';
  return { values: { email, password }, errors };
}

module.exports = { normalizeEmail, validateLogin, validateRegistration };
