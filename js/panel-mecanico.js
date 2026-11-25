const jobsContainer = document.querySelector('#lista-trabajos');
const messageElement = document.querySelector('#mensaje-trabajos');

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

function detail(label, value) {
  const row = document.createElement('div');
  row.className = 'detalle-trabajo-mecanico';
  const caption = document.createElement('span');
  caption.textContent = label;
  const content = document.createElement('strong');
  content.textContent = value;
  row.append(caption, content);
  return row;
}

function renderJobs(jobs) {
  jobsContainer.replaceChildren();
  if (!jobs.length) {
    const empty = document.createElement('div');
    empty.className = 'trabajos-mecanico-vacios';
    const heading = document.createElement('h3');
    heading.textContent = 'Todavía no hay trabajos asignados';
    const copy = document.createElement('p');
    copy.textContent = 'Los servicios aprobados que se asignen a tu elevador van a aparecer acá.';
    empty.append(heading, copy);
    jobsContainer.append(empty);
    return;
  }

  jobs.forEach((job) => {
    const card = document.createElement('article');
    card.className = 'tarjeta-trabajo-mecanico';
    const top = document.createElement('div');
    top.className = 'trabajo-mecanico-top';
    const receipt = document.createElement('span');
    receipt.className = 'trabajo-mecanico-comprobante';
    receipt.textContent = `Comprobante #${job.receiptNumber}`;
    const schedule = document.createElement('span');
    schedule.className = 'trabajo-mecanico-horario';
    schedule.textContent = `${job.startTime}–${job.endTime}`;
    top.append(receipt, schedule);

    const heading = document.createElement('h3');
    heading.textContent = job.serviceName;
    const date = document.createElement('p');
    date.className = 'trabajo-mecanico-fecha';
    date.textContent = formatDate(job.date);
    const details = document.createElement('div');
    details.className = 'trabajo-mecanico-detalles';
    details.append(
      detail('Auto', job.vehicleModel),
      detail('Cliente', job.customerName)
    );
    card.append(top, heading, date, details);
    jobsContainer.append(card);
  });
}

async function loadJobs() {
  showMessage('Actualizando agenda…');
  try {
    const response = await fetch('/api/appointments/mechanic', {
      credentials: 'same-origin', headers: { Accept: 'application/json' }
    });
    const result = await response.json();
    if (response.status === 401 || response.status === 403) {
      window.location.replace('pagina1.html');
      return;
    }
    if (!response.ok) throw new Error(result.message || 'No se pudo cargar la agenda asignada.');
    document.querySelector('#elevador-mecanico').textContent = result.mechanic.liftName;
    renderJobs(result.appointments);
    showMessage(result.appointments.length
      ? `${result.appointments.length} trabajo${result.appointments.length === 1 ? '' : 's'} confirmado${result.appointments.length === 1 ? '' : 's'} en tu agenda.`
      : 'No tenés trabajos confirmados próximos.');
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function checkMechanicSession() {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!response.ok) return window.location.replace('pagina1.html');
    const { user } = await response.json();
    if (user.role !== 'mecanico') {
      const destination = ({ 'jefe-taller': 'panel-jefe.html', cliente: 'panel-usuario.html' })[user.role] || 'pagina1.html';
      return window.location.replace(destination);
    }
    document.querySelector('#saludo-mecanico').textContent = `Hola, ${user.nombre}`;
    return true;
  } catch {
    showMessage('No se pudo conectar con el servidor MotorFix.', true);
    return false;
  }
}

document.querySelector('#actualizar-trabajos').addEventListener('click', loadJobs);
document.querySelector('#cerrar-sesion').addEventListener('click', async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } finally {
    window.location.replace('pagina1.html');
  }
});

checkMechanicSession().then((isMechanic) => isMechanic && loadJobs());
