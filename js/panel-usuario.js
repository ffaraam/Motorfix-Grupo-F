const appointmentsContainer = document.querySelector('#lista-mis-turnos');
const messageElement = document.querySelector('#mensaje-mis-turnos');
let appointments = [];
let activeView = 'turnos';

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

function canCancel(appointment) {
  if (!['solicitado', 'confirmado'].includes(appointment.status)) return false;
  const [year, month, day] = appointment.date.split('-').map(Number);
  const [hours, minutes] = appointment.startTime.split(':').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(start);
  const parts = Object.fromEntries(local.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  const offset = Date.UTC(year, month - 1, day, hours, minutes) - Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  start.setTime(start.getTime() + offset);
  return start.getTime() - Date.now() >= 2 * 60 * 60 * 1000;
}

function vehicleStatusCopy(appointment) {
  if (appointment.vehicleStatus) return `Estado del vehículo: ${appointment.vehicleStatus}.`;
  if (appointment.status === 'confirmado') return 'El taller todavía no actualizó el estado del vehículo.';
  return '';
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
  const visibleAppointments = activeView === 'reparaciones'
    ? appointments.filter((appointment) => appointment.status === 'finalizado')
    : appointments.filter((appointment) => appointment.status !== 'finalizado');
  if (!visibleAppointments.length) {
    const empty = document.createElement('div');
    empty.className = 'mis-turnos-vacio';
    const heading = document.createElement('h3');
    heading.textContent = activeView === 'reparaciones' ? 'Todavía no hay reparaciones realizadas' : 'No tenés turnos pendientes o futuros';
    const copy = document.createElement('p');
    copy.textContent = activeView === 'reparaciones' ? 'Los trabajos finalizados por el taller aparecerán acá.' : 'Cuando envíes una solicitud, vas a poder seguir su estado desde acá.';
    empty.append(heading, copy);
    if (activeView === 'turnos') {
      const link = document.createElement('a');
      link.className = 'boton-principal';
      link.href = 'pagina3.html';
      link.textContent = 'Solicitar un turno';
      empty.append(link);
    }
    appointmentsContainer.append(empty);
    return;
  }

  visibleAppointments.forEach((appointment) => {
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
      createDetail('Elevador', appointment.liftName || 'A asignar por el jefe'),
      ...(vehicleStatusCopy(appointment) ? [createDetail('Estado del vehículo', appointment.vehicleStatus || 'Aún sin actualizar')] : [])
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
    if (activeView === 'turnos' && canCancel(appointment)) {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'boton-cancelar-turno';
      cancel.dataset.cancelAppointment = appointment.id;
      cancel.textContent = 'Cancelar turno';
      card.append(cancel);
    }
    if (appointment.isDelayed) {
      const delay = document.createElement('p');
      delay.className = 'alerta-demora-cliente';
      delay.textContent = 'El trabajo presenta una demora de 15 minutos o más sobre el estimativo.';
      card.append(delay);
    }
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
    const visibleCount = activeView === 'reparaciones' ? appointments.filter((item) => item.status === 'finalizado').length : appointments.filter((item) => item.status !== 'finalizado').length;
    showMessage(visibleCount ? `${visibleCount} ${activeView === 'reparaciones' ? 'reparación' : 'turno'}${visibleCount === 1 ? '' : 's'}.` : '');
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
appointmentsContainer.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-cancel-appointment]');
  if (!button) return;
  button.disabled = true;
  button.textContent = 'Cancelando…';
  try {
    const response = await fetch(`/api/appointments/${encodeURIComponent(button.dataset.cancelAppointment)}/cancel`, {
      method: 'PATCH', credentials: 'same-origin', headers: { Accept: 'application/json' }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'No se pudo cancelar el turno.');
    showMessage(result.message);
    await loadAppointments();
  } catch (error) {
    showMessage(error.message, true);
    button.disabled = false;
    button.textContent = 'Cancelar turno';
  }
});
document.querySelector('.panel-usuario-secciones').addEventListener('click', (event) => {
  const button = event.target.closest('[data-vista-cliente]');
  if (!button) return;
  activeView = button.dataset.vistaCliente;
  document.querySelectorAll('[data-vista-cliente]').forEach((tab) => {
    const selected = tab === button;
    tab.classList.toggle('activo', selected);
    tab.setAttribute('aria-selected', String(selected));
  });
  document.querySelector('#etiqueta-lista-cliente').textContent = activeView === 'reparaciones' ? 'HISTORIAL' : 'AGENDA';
  document.querySelector('#titulo-lista-cliente').textContent = activeView === 'reparaciones' ? 'Reparaciones realizadas' : 'Tus turnos';
  renderAppointments();
  const visibleCount = activeView === 'reparaciones' ? appointments.filter((item) => item.status === 'finalizado').length : appointments.filter((item) => item.status !== 'finalizado').length;
  showMessage(visibleCount ? `${visibleCount} ${activeView === 'reparaciones' ? 'reparación' : 'turno'}${visibleCount === 1 ? '' : 's'}.` : '');
});
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
