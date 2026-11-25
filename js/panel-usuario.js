const appointmentsContainer = document.querySelector('#lista-mis-turnos');
const messageElement = document.querySelector('#mensaje-mis-turnos');
let appointments = [];

function showMessage(message, isError = false) {
  messageElement.textContent = message;
  messageElement.classList.toggle('es-error', isError);
}

function formatDate(dateValue) {
  const date = new Date(`${dateValue}T12:00:00Z`);
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(date);
}

function formatElapsed(timestamp) {
  const reviewedTime = new Date(timestamp).getTime();
  if (!Number.isFinite(reviewedTime)) return 'momento no disponible';
  const totalSeconds = Math.max(0, Math.floor((Date.now() - reviewedTime) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours} h ${String(minutes).padStart(2, '0')} min ${String(seconds).padStart(2, '0')} s`;
}

function statusCopy(appointment) {
  if (appointment.status === 'confirmado') return `Aprobado hace ${formatElapsed(appointment.reviewedAt)}.`;
  if (appointment.status === 'finalizado') return `Trabajo finalizado hace ${formatElapsed(appointment.completedAt)}.`;
  if (appointment.status === 'rechazado') return `Rechazado hace ${formatElapsed(appointment.reviewedAt)}.`;
  if (appointment.status === 'cancelado') return 'Este turno fue cancelado.';
  return 'Tu solicitud está pendiente de revisión por el jefe de taller.';
}

function createDetail(label, value) {
  const detail = document.createElement('div');
  detail.className = 'detalle-mis-turnos';
  const name = document.createElement('span');
  name.textContent = label;
  const content = document.createElement('strong');
  content.textContent = value;
  detail.append(name, content);
  return detail;
}

function renderAppointments() {
  appointmentsContainer.replaceChildren();
  if (!appointments.length) {
    const empty = document.createElement('div');
    empty.className = 'mis-turnos-vacio';
    const heading = document.createElement('h3');
    heading.textContent = 'Todavía no tenés turnos';
    const copy = document.createElement('p');
    copy.textContent = 'Cuando envíes una solicitud, vas a poder seguir su estado desde acá.';
    const link = document.createElement('a');
    link.className = 'boton-principal';
    link.href = 'pagina3.html';
    link.textContent = 'Solicitar un turno';
    empty.append(heading, copy, link);
    appointmentsContainer.append(empty);
    return;
  }

  appointments.forEach((appointment) => {
    const card = document.createElement('article');
    card.className = 'tarjeta-mi-turno';

    const top = document.createElement('div');
    top.className = 'mi-turno-top';
    const receipt = document.createElement('span');
    receipt.className = 'mi-turno-comprobante';
    receipt.textContent = `Comprobante #${appointment.id.slice(0, 8).toUpperCase()}`;
    const badge = document.createElement('span');
    badge.className = `estado-turno estado-${appointment.status}`;
    badge.textContent = ({ solicitado: 'Pendiente', confirmado: 'Aprobado', finalizado: 'Trabajo finalizado', rechazado: 'Rechazado', cancelado: 'Cancelado' })[appointment.status] || appointment.status;
    top.append(receipt, badge);

    const heading = document.createElement('h3');
    heading.textContent = appointment.serviceName;
    const date = document.createElement('p');
    date.className = 'mi-turno-fecha';
    date.textContent = `${formatDate(appointment.date)} · ${appointment.startTime} a ${appointment.endTime}`;

    const details = document.createElement('div');
    details.className = 'mi-turno-detalles';
    details.append(
      createDetail('Vehículo', `${appointment.vehicle.make} ${appointment.vehicle.model}`),
      createDetail('Elevador', appointment.liftName || 'A asignar por el jefe')
    );

    const status = document.createElement('p');
    status.className = `mi-turno-respuesta respuesta-${appointment.status}`;
    status.dataset.reviewedAt = appointment.status === 'finalizado' ? appointment.completedAt || '' : appointment.reviewedAt || '';
    status.dataset.status = appointment.status;
    status.textContent = statusCopy(appointment);

    const quote = document.createElement('p');
    quote.className = 'mi-turno-cotizacion';
    quote.textContent = appointment.estimatedTotal == null
      ? 'Precio: pendiente'
      : `${appointment.quoteStatus === 'provisoria' ? 'Cotización provisional' : 'Precio del servicio'}: $${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(appointment.estimatedTotal)} ${appointment.currency || 'ARS'}`;

    card.append(top, heading, date, details, status, quote);
    appointmentsContainer.append(card);
  });
}

async function loadAppointments() {
  showMessage('Actualizando tus turnos…');
  try {
    const response = await fetch('/api/appointments/mine', {
      credentials: 'same-origin', headers: { Accept: 'application/json' }
    });
    const result = await response.json();
    if (response.status === 401 || response.status === 403) {
      window.location.replace('pagina1.html');
      return;
    }
    if (!response.ok) throw new Error(result.message || 'No se pudieron cargar tus turnos.');
    appointments = result.appointments;
    renderAppointments();
    showMessage(appointments.length ? `${appointments.length} turno${appointments.length === 1 ? '' : 's'} en tu historial.` : '');
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function loadUser() {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!response.ok) return window.location.replace('pagina1.html');
    const { user } = await response.json();
    if (user.role !== 'cliente') return window.location.replace(user.role === 'jefe-taller' ? 'panel-jefe.html' : 'panel-mecanico.html');
    document.querySelector('#saludo-usuario').textContent = `Hola, ${user.nombre.split(/\s+/)[0]}. Acá podés consultar tus solicitudes y la respuesta del taller.`;
    return true;
  } catch {
    showMessage('No se pudo conectar con MotorFix.', true);
    return false;
  }
}

function updateApprovalClocks() {
  appointmentsContainer.querySelectorAll('.mi-turno-respuesta[data-reviewed-at]').forEach((element) => {
    const status = element.dataset.status;
    if (!['confirmado', 'rechazado', 'finalizado'].includes(status)) return;
    const label = status === 'confirmado' ? 'Aprobado' : status === 'rechazado' ? 'Rechazado' : 'Trabajo finalizado';
    element.textContent = `${label} hace ${formatElapsed(element.dataset.reviewedAt)}.`;
  });
}

document.querySelector('#actualizar-mis-turnos').addEventListener('click', loadAppointments);
document.querySelector('#cerrar-sesion').addEventListener('click', async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } finally {
    window.location.replace('pagina1.html');
  }
});

loadUser().then((isClient) => isClient && loadAppointments());
window.setInterval(updateApprovalClocks, 1000);
window.setInterval(loadAppointments, 30000);
