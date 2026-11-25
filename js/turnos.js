const appointmentForm = document.querySelector('#form-turno');
const servicesContainer = document.querySelector('#opciones-servicio');
const dateInput = document.querySelector('#fecha');
const timeInput = document.querySelector('#horario');
const requestButton = appointmentForm.querySelector('button[type="submit"]');
let availableSlots = [];
let availabilityRequestId = 0;

function localDateValue(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function showMessage(message, isError = false) {
  const element = document.querySelector('#mensaje-turno');
  element.textContent = message;
  element.classList.toggle('es-error', isError);
  element.classList.toggle('es-exito', !isError && Boolean(message));
}

function formatPrice(amount) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);
}

function updateAppointmentSummary() {
  const selectedService = appointmentForm.querySelector('input[name="servicio"]:checked');
  const make = document.querySelector('#marca').value.trim();
  const model = document.querySelector('#modelo').value.trim();
  const dateValue = dateInput.value;
  const selectedSlot = availableSlots.find((slot) => slot.startTime === timeInput.value);

  document.querySelector('#resumen-servicio').textContent = selectedService?.dataset.name || 'Aún sin elegir';
  document.querySelector('#resumen-vehiculo').textContent = make || model
    ? [make, model].filter(Boolean).join(' ')
    : 'A completar';

  if (!dateValue) {
    document.querySelector('#resumen-fecha').textContent = 'A seleccionar';
  } else {
    const [year, month, day] = dateValue.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dateLabel = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(date);
    document.querySelector('#resumen-fecha').textContent = selectedSlot
      ? `${dateLabel} · ${selectedSlot.startTime}–${selectedSlot.endTime}`
      : dateLabel;
  }

  requestButton.disabled = !(selectedService && make && model && dateValue && selectedSlot);
}

function renderServices(services) {
  servicesContainer.replaceChildren();
  const available = services.filter((service) => service.available);
  if (!available.length) {
    servicesContainer.innerHTML = '<p class="cargando-servicios">No hay servicios habilitados en este momento. Consultá con el taller.</p>';
    return;
  }

  available.forEach((service, index) => {
    const label = document.createElement('label');
    label.className = 'opcion-servicio';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'servicio';
    radio.value = service.id;
    radio.dataset.name = service.name;
    radio.required = true;
    const content = document.createElement('span');
    content.className = 'opcion-contenido';
    const number = document.createElement('span');
    number.className = 'opcion-icono';
    number.setAttribute('aria-hidden', 'true');
    number.textContent = String(index + 1).padStart(2, '0');
    const description = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = service.name;
    const price = document.createElement('small');
    price.className = 'servicio-precio';
    price.textContent = service.price == null
      ? 'Precio a consultar'
      : formatPrice(service.price);
    const duration = document.createElement('small');
    duration.textContent = `${service.durationMinutes} min${service.durationIsProvisional ? ' estimados · duración provisoria' : ' de duración'}`;
    const detail = document.createElement('small');
    detail.className = 'servicio-descripcion';
    detail.textContent = service.description || '';
    description.append(name, price, duration, detail);
    const check = document.createElement('span');
    check.className = 'opcion-check';
    check.setAttribute('aria-hidden', 'true');
    check.textContent = '✓';
    content.append(number, description, check);
    label.append(radio, content);
    servicesContainer.append(label);
  });
}

async function loadServices() {
  try {
    const response = await fetch('/api/appointments/services', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'No se pudieron cargar los servicios.');
    renderServices(result.services);
  } catch (error) {
    servicesContainer.innerHTML = '<p class="cargando-servicios es-error">No se pudieron cargar los servicios. Revisá la conexión e intentá actualizar la página.</p>';
    showMessage(error.message, true);
  }
}

async function loadAvailability() {
  const currentRequestId = ++availabilityRequestId;
  const service = appointmentForm.querySelector('input[name="servicio"]:checked');
  const date = dateInput.value;
  availableSlots = [];
  timeInput.disabled = true;
  timeInput.replaceChildren(new Option(service && date ? 'Consultando disponibilidad…' : 'Elegí servicio y fecha primero', ''));
  document.querySelector('#resumen-costo').textContent = 'A cotizar';
  document.querySelector('#detalle-costo').textContent = 'Se consultará la cotización vigente del taller.';
  updateAppointmentSummary();

  if (!service || !date) return;
  showMessage('Consultando horarios disponibles…');

  try {
    const query = new URLSearchParams({ serviceId: service.value, date });
    const response = await fetch(`/api/appointments/availability?${query}`, {
      credentials: 'same-origin', headers: { Accept: 'application/json' }
    });
    const result = await response.json();
    if (currentRequestId !== availabilityRequestId) return;
    if (!response.ok) throw new Error(result.message || 'No se pudo consultar la disponibilidad.');

    availableSlots = result.options;
    timeInput.replaceChildren(new Option(availableSlots.length ? 'Seleccioná horario' : 'No hay horarios disponibles', ''));
    availableSlots.forEach((slot) => {
      const option = new Option(`${slot.startTime}–${slot.endTime}`, slot.startTime);
      timeInput.add(option);
    });
    timeInput.disabled = !availableSlots.length;

    if (result.quote.estimatedTotal == null) {
      document.querySelector('#resumen-costo').textContent = 'A cotizar';
      document.querySelector('#detalle-costo').textContent = 'El taller aún no cargó la cotización para este servicio.';
    } else {
      document.querySelector('#resumen-costo').textContent = `${formatPrice(result.quote.estimatedTotal)}${result.quote.status === 'provisoria' ? ' ARS' : ''}`;
      document.querySelector('#detalle-costo').textContent = result.quote.status === 'provisoria'
        ? 'Valor simbólico provisional; el taller definirá la cotización final.'
        : 'Precio vigente del servicio.';
    }

    if (availableSlots.length) showMessage('Horarios actualizados. Elegí una opción para continuar.');
    else if (result.dailyCapacity.remaining === 0) showMessage(`El taller ya completó sus ${result.dailyCapacity.limit} turnos diarios para esa fecha. Elegí otro día.`, true);
    else showMessage('No quedan elevadores libres en esa fecha. Probá con otro día.', true);
  } catch (error) {
    if (currentRequestId !== availabilityRequestId) return;
    timeInput.disabled = true;
    timeInput.replaceChildren(new Option('No se pudo cargar la disponibilidad', ''));
    showMessage(error.message, true);
  }
  updateAppointmentSummary();
}

async function checkSession() {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!response.ok) {
      window.location.replace('pagina1.html');
      return false;
    }
    const { user } = await response.json();
    document.querySelector('#saludo-cliente').textContent = `Hola, ${user.nombre.split(/\s+/)[0]}`;
    return true;
  } catch {
    showMessage('Conectate al servidor MotorFix para consultar tu sesión.', true);
    return false;
  }
}

dateInput.min = localDateValue(new Date());
servicesContainer.addEventListener('change', loadAvailability);
dateInput.addEventListener('change', loadAvailability);
appointmentForm.addEventListener('input', updateAppointmentSummary);
timeInput.addEventListener('change', updateAppointmentSummary);

appointmentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!appointmentForm.reportValidity()) return;
  const service = appointmentForm.querySelector('input[name="servicio"]:checked');
  const slot = availableSlots.find((item) => item.startTime === timeInput.value);
  if (!slot) return showMessage('Elegí un horario que siga disponible.', true);

  const buttonLabel = requestButton.innerHTML;
  requestButton.disabled = true;
  requestButton.textContent = 'Registrando solicitud…';
  showMessage('Volviendo a validar el elevador y el horario…');

  try {
    const response = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        serviceId: service.value,
        vehicle: {
          make: document.querySelector('#marca').value.trim(),
          model: document.querySelector('#modelo').value.trim()
        },
        date: dateInput.value,
        startTime: slot.startTime
      })
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 409) await loadAvailability();
      throw new Error(result.message || 'No se pudo registrar el turno.');
    }

    const appointment = result.appointment;
    document.querySelector('#comprobante-id').textContent = `N.º ${appointment.receiptNumber || appointment.id.slice(0, 8).toUpperCase()}`;
    const dateLabel = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(`${appointment.date}T12:00:00`));
    const quoteLabel = appointment.estimatedTotal == null
      ? 'Presupuesto pendiente'
      : `${formatPrice(appointment.estimatedTotal)}${appointment.quoteStatus === 'provisoria' ? ' ARS (valor simbólico)' : ''}`;
    document.querySelector('#comprobante-detalle').textContent = `${appointment.serviceName} · ${appointment.vehicle.make} ${appointment.vehicle.model} · ${dateLabel}, ${appointment.startTime}–${appointment.endTime} (${appointment.durationMinutes} min) · Elevador a asignar por el jefe · ${quoteLabel}`;
    document.querySelector('#comprobante-turno').hidden = false;
    showMessage('Tu solicitud quedó registrada y está pendiente de aprobación del jefe de taller.', false);
    document.querySelector('#comprobante-turno').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    requestButton.innerHTML = buttonLabel;
    updateAppointmentSummary();
  }
});

document.querySelector('#cerrar-sesion').addEventListener('click', async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } finally {
    window.location.replace('pagina1.html');
  }
});

updateAppointmentSummary();
checkSession().then((authenticated) => authenticated && loadServices());
