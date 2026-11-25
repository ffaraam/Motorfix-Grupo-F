const loginForm = document.querySelector('#form-login');
const registerForm = document.querySelector('#form-registro');

function showFormMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('es-error', isError);
  element.classList.toggle('es-exito', !isError && Boolean(message));
}

async function sendAuthRequest(endpoint, payload) {
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });
  } catch {
    throw new Error('No se pudo conectar con MotorFix. Verificá que el servidor esté iniciado.');
  }

  const result = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || 'No se pudo completar la solicitud. Intentá nuevamente.');
  return result;
}

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = document.querySelector('#mensaje-login');
    const button = loginForm.querySelector('button[type="submit"]');
    const email = document.querySelector('#email-login').value.trim();
    const password = document.querySelector('#contrasena').value;

    if (!loginForm.reportValidity()) return;
    showFormMessage(message, 'Ingresando…');
    button.disabled = true;
    try {
      const result = await sendAuthRequest('/api/auth/login', { email, password });
      const destination = ({ 'jefe-taller': 'panel-jefe.html', mecanico: 'panel-mecanico.html', cliente: 'panel-usuario.html' })[result.user.role] || 'panel-usuario.html';
      window.location.assign(destination);
    } catch (error) {
      showFormMessage(message, error.message, true);
      button.disabled = false;
    }
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = document.querySelector('#mensaje-registro');
    const button = registerForm.querySelector('button[type="submit"]');
    const payload = {
      nombre: document.querySelector('#nombre').value.trim(),
      email: document.querySelector('#email').value.trim(),
      telefono: document.querySelector('#telefono').value.trim(),
      password: document.querySelector('#nueva-contrasena').value
    };

    if (!registerForm.reportValidity()) return;
    showFormMessage(message, 'Creando tu cuenta…');
    button.disabled = true;
    try {
      await sendAuthRequest('/api/auth/register', payload);
      window.location.assign('panel-usuario.html');
    } catch (error) {
      showFormMessage(message, error.message, true);
      button.disabled = false;
    }
  });
}
