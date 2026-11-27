const tableBody = document.querySelector('#lista-turnos');
const message = document.querySelector('#mensaje-panel');
const liftsContainer = document.querySelector('#lista-elevadores');
const liftsMessage = document.querySelector('#mensaje-elevadores');
const mechanicsContainer = document.querySelector('#lista-mecanicos');
const mechanicsMessage = document.querySelector('#mensaje-mecanicos');
const serviceDemandContainer = document.querySelector('#lista-demanda-servicios');
const mechanicAvailabilityContainer = document.querySelector('#lista-disponibilidad-mecanicos');
const dailyReportRows = document.querySelector('#lista-reporte-diario');
const dailyReportMessage = document.querySelector('#mensaje-reporte-diario');
const workshopSettingsForm = document.querySelector('#form-configuracion-taller');
const workshopSettingsMessage = document.querySelector('#mensaje-configuracion-taller');
const workshopServicesContainer = document.querySelector('#lista-configuracion-servicios');
let appointments = [];
let lifts = [];
let mechanics = [];
let activeFilter = 'todos';

function showWorkshopSettingsMessage(text, isError = false) {
  workshopSettingsMessage.textContent = text;
  workshopSettingsMessage.classList.toggle('es-error', isError);
}

function renderWorkshopSettings(settings) {
  const { workshop, services } = settings;
  workshopSettingsForm.elements.openingTime.value = workshop.openingTime;
  workshopSettingsForm.elements.closingTime.value = workshop.closingTime;
  workshopSettingsForm.elements.slotIntervalMinutes.value = workshop.slotIntervalMinutes;
  workshopSettingsForm.elements.maxDailyAppointments.value = workshop.maxDailyAppointments;
  workshopSettingsForm.querySelectorAll('[name="businessDays"]').forEach((input) => {
    input.checked = workshop.businessDays.includes(Number(input.value));
  });
  workshopServicesContainer.replaceChildren();
  services.forEach((service) => {
    const card = document.createElement('article');
    card.className = 'configuracion-servicio-card';
    card.dataset.serviceId = service.id;
    const title = document.createElement('h3');
    title.textContent = service.name;
    const fields = document.createElement('div');
    fields.className = 'configuracion-servicio-campos';
    const name = document.createElement('label');
    name.textContent = 'Nombre';
    const nameInput = document.createElement('input');
    nameInput.name = 'name';
    nameInput.value = service.name;
    nameInput.maxLength = 100;
    nameInput.required = true;
    name.append(nameInput);
    const description = document.createElement('label');
    description.textContent = 'Descripción';
    const descriptionInput = document.createElement('textarea');
    descriptionInput.name = 'description';
    descriptionInput.value = service.description || '';
    descriptionInput.maxLength = 500;
    description.append(descriptionInput);
    const price = document.createElement('label');
    price.textContent = 'Precio estimado (ARS)';
    const priceInput = document.createElement('input');
    priceInput.name = 'estimatedPrice';
    priceInput.type = 'number';
    priceInput.min = '0';
    priceInput.max = '100000000';
    priceInput.step = '0.01';
    priceInput.value = service.estimatedPrice;
    priceInput.required = true;
    price.append(priceInput);
    const duration = document.createElement('label');
    duration.textContent = 'Duración estimada (min)';
    const durationInput = document.createElement('input');
    durationInput.name = 'durationMinutes';
    durationInput.type = 'number';
    durationInput.min = '15';
    durationInput.max = '1440';
    durationInput.step = '15';
    durationInput.value = service.durationMinutes;
    durationInput.required = true;
    duration.append(durationInput);
    fields.append(name, description, price, duration);
    const toggles = document.createElement('div');
    toggles.className = 'configuracion-servicio-toggles';
    [['enabled', 'Servicio habilitado'], ['suppliesAvailable', 'Hay insumos disponibles']].forEach(([key, labelText]) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = key;
      input.checked = Boolean(service[key]);
      label.append(input, document.createTextNode(labelText));
      toggles.append(label);
    });
    card.append(title, fields, toggles);
    workshopServicesContainer.append(card);
  });
}

async function loadWorkshopSettings() {
  showWorkshopSettingsMessage('Cargando configuración…');
  try {
    const response = await fetch('/api/appointments/management/settings', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'No se pudo cargar la configuración.');
    renderWorkshopSettings(result);
    showWorkshopSettingsMessage('Configuración cargada.');
  } catch (error) {
    showWorkshopSettingsMessage(error.message, true);
  }
}

document.querySelector('#recargar-configuracion').addEventListener('click', loadWorkshopSettings);
workshopSettingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!workshopSettingsForm.reportValidity()) return;
  const services = [...workshopServicesContainer.querySelectorAll('.configuracion-servicio-card')].map((card) => ({
    id: card.dataset.serviceId,
    name: card.querySelector('[name="name"]').value,
    description: card.querySelector('[name="description"]').value,
    estimatedPrice: Number(card.querySelector('[name="estimatedPrice"]').value),
    durationMinutes: Number(card.querySelector('[name="durationMinutes"]').value),
    enabled: card.querySelector('[name="enabled"]').checked,
    suppliesAvailable: card.querySelector('[name="suppliesAvailable"]').checked
  }));
  const workshop = {
    openingTime: workshopSettingsForm.elements.openingTime.value,
    closingTime: workshopSettingsForm.elements.closingTime.value,
    slotIntervalMinutes: Number(workshopSettingsForm.elements.slotIntervalMinutes.value),
    maxDailyAppointments: Number(workshopSettingsForm.elements.maxDailyAppointments.value),
    businessDays: [...workshopSettingsForm.querySelectorAll('[name="businessDays"]:checked')].map((input) => Number(input.value))
  };
  const submit = workshopSettingsForm.querySelector('[type="submit"]');
  submit.disabled = true;
  showWorkshopSettingsMessage('Guardando cambios…');
  try {
    const response = await fetch('/api/appointments/management/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ services, workshop })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'No se pudo guardar la configuración.');
    renderWorkshopSettings(result);
    showWorkshopSettingsMessage(result.message);
    await Promise.all([loadAppointments(), loadWorkshopSettings()]);
  } catch (error) {
    showWorkshopSettingsMessage(error.message, true);
  } finally {
    submit.disabled = false;
  }
});

function statusLabel(status) {
  return ({ solicitado: 'Pendiente', confirmado: 'Aprobado', finalizado: 'Trabajo finalizado', rechazado: 'Rechazado', cancelado: 'Cancelado' })[status] || status;
}

function vehicleStatusLabel(status) {
  return status || 'Sin iniciar';
}

function showPanelMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('es-error', isError);
}

function showLiftMessage(text, isError = false) {
  liftsMessage.textContent = text;
  liftsMessage.classList.toggle('es-error', isError);
}

function showMechanicMessage(text, isError = false) {
  mechanicsMessage.textContent = text;
  mechanicsMessage.classList.toggle('es-error', isError);
}

function renderMechanics() {
  mechanicsContainer.replaceChildren();
  mechanics.forEach((mechanic) => {
    const card = document.createElement('article');
    card.className = 'tarjeta-asignacion-mecanico';
    const name = document.createElement('h3');
    name.textContent = mechanic.name;
    const email = document.createElement('p');
    email.textContent = mechanic.email;
    const label = document.createElement('label');
    label.textContent = 'Elevador asignado';
    const select = document.createElement('select');
    select.dataset.mechanicSelect = mechanic.id;
    select.setAttribute('aria-label', `Elevador asignado a ${mechanic.name}`);
    lifts.filter((lift) => lift.enabled !== false || lift.id === mechanic.liftId)
      .forEach((lift) => select.add(new Option(`${lift.name}${lift.enabled === false ? ' · deshabilitado' : ''}`, lift.id)));
    select.value = mechanic.liftId;
    label.append(select);
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'boton-guardar-asignacion-mecanico';
    save.dataset.mechanicId = mechanic.id;
    save.textContent = 'Guardar asignación';
    card.append(name, email, label, save);
    mechanicsContainer.append(card);
  });
}

function renderLifts() {
  liftsContainer.replaceChildren();
  lifts.forEach((lift) => {
    const card = document.createElement('article');
    card.className = 'tarjeta-elevador';
    const top = document.createElement('div');
    top.className = 'tarjeta-elevador-top';
    const name = document.createElement('h3');
    name.textContent = lift.name;
    const status = document.createElement('span');
    status.className = `estado-elevador estado-elevador-${lift.status}`;
    status.textContent = ({ disponible: 'Disponible', ocupado: 'Ocupado', deshabilitado: 'Deshabilitado' })[lift.status] || lift.status;
    top.append(name, status);
    card.append(top);

    const detail = document.createElement('p');
    detail.className = 'tarjeta-elevador-detalle';
    detail.textContent = lift.appointment
      ? `${lift.appointment.startTime}–${lift.appointment.endTime} · ${lift.appointment.serviceName}`
      : lift.status === 'deshabilitado' ? 'No recibe asignaciones.' : 'Sin turno en curso.';
    card.append(detail);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = lift.enabled === false ? 'accion-habilitar-elevador' : 'accion-deshabilitar-elevador';
    toggle.dataset.liftId = lift.id;
    toggle.dataset.enabled = String(lift.enabled === false);
    toggle.textContent = lift.status === 'ocupado' ? 'En uso' : lift.enabled === false ? 'Habilitar' : 'Deshabilitar';
    toggle.disabled = lift.status === 'ocupado';
    card.append(toggle);
    liftsContainer.append(card);
  });
}

function formatDashboardDate(value) {
  const date = new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long', day: 'numeric', month: 'long'
  }).format(date);
}

function renderDashboard(dashboard) {
  document.querySelector('#fecha-tablero').textContent = formatDashboardDate(dashboard.date);
  serviceDemandContainer.replaceChildren();
  const demanded = dashboard.mostDemandedServices.filter((service) => service.appointments > 0);
  if (!demanded.length) {
    const empty = document.createElement('li');
    empty.textContent = 'Todavía no hay solicitudes activas para hoy.';
    serviceDemandContainer.append(empty);
  } else {
    demanded.forEach((service, index) => {
      const item = document.createElement('li');
      item.className = 'fila-demanda-servicio';
      const rank = document.createElement('span');
      rank.className = 'demanda-puesto';
      rank.textContent = String(index + 1).padStart(2, '0');
      const name = document.createElement('span');
      name.className = 'demanda-nombre';
      name.textContent = service.name;
      const count = document.createElement('strong');
      count.className = 'demanda-cantidad';
      count.textContent = `${service.appointments} ${service.appointments === 1 ? 'turno' : 'turnos'}`;
      item.append(rank, name, count);
      serviceDemandContainer.append(item);
    });
  }

  document.querySelector('#mecanicos-disponibles').textContent = String(dashboard.mechanics.available);
  document.querySelector('#mecanicos-total').textContent = `de ${dashboard.mechanics.total}`;
  mechanicAvailabilityContainer.replaceChildren();
  if (!dashboard.mechanics.list.length) {
    const empty = document.createElement('li');
    empty.textContent = 'No hay mecánicos configurados.';
    mechanicAvailabilityContainer.append(empty);
  } else {
    dashboard.mechanics.list.forEach((mechanic) => {
      const item = document.createElement('li');
      item.className = 'fila-disponibilidad-mecanico';
      const details = document.createElement('span');
      details.textContent = `${mechanic.name} · ${mechanic.liftName}`;
      const badge = document.createElement('strong');
      badge.className = mechanic.available ? 'mecanico-disponible' : 'mecanico-ocupado';
      badge.textContent = mechanic.available ? 'Libre' : 'Ocupado';
      item.append(details, badge);
      mechanicAvailabilityContainer.append(item);
    });
  }
}

function updateCounters() {
  document.querySelector('#cuenta-pendientes').textContent = appointments.filter((item) => item.status === 'solicitado').length;
  document.querySelector('#cuenta-aprobadas').textContent = appointments.filter((item) => item.status === 'confirmado').length;
  document.querySelector('#cuenta-finalizadas').textContent = appointments.filter((item) => item.status === 'finalizado').length;
  document.querySelector('#cuenta-rechazadas').textContent = appointments.filter((item) => item.status === 'rechazado').length;
}

function formatAppointmentDate(dateValue) {
  const date = new Date(`${dateValue}T12:00:00Z`);
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  }).format(date);
}

function cell(className, text) {
  const element = document.createElement('td');
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function renderAppointments() {
  tableBody.replaceChildren();
  const visibleAppointments = activeFilter === 'todos'
    ? appointments
    : appointments.filter((appointment) => appointment.status === activeFilter);

  if (!visibleAppointments.length) {
    const row = document.createElement('tr');
    const empty = cell('tabla-turnos-vacia', appointments.length ? 'No hay solicitudes en este filtro.' : 'Todavía no hay turnos solicitados.');
    empty.colSpan = 9;
    row.append(empty);
    tableBody.append(row);
    return;
  }

  visibleAppointments.forEach((appointment) => {
    const row = document.createElement('tr');
    row.append(cell('comprobante-panel', `#${appointment.receiptNumber || appointment.id.slice(0, 8).toUpperCase()}`));

    const customer = document.createElement('td');
    customer.className = 'cliente-panel';
    const customerName = document.createElement('strong');
    customerName.textContent = appointment.customer.name;
    const customerEmail = document.createElement('span');
    customerEmail.textContent = appointment.customer.email;
    customer.append(customerName, customerEmail);
    row.append(customer);
    row.append(cell('telefono-panel', appointment.customer.phone || 'No informado'));

    const schedule = document.createElement('td');
    schedule.className = 'horario-panel';
    const scheduleDate = document.createElement('strong');
    scheduleDate.textContent = formatAppointmentDate(appointment.date);
    const scheduleTime = document.createElement('span');
    scheduleTime.textContent = `${appointment.startTime}–${appointment.endTime}`;
    schedule.append(scheduleDate, scheduleTime);
    row.append(schedule);

    const liftCell = document.createElement('td');
    liftCell.className = 'asignacion-elevador-panel';
    if (['solicitado', 'confirmado'].includes(appointment.status)) {
      const select = document.createElement('select');
      select.setAttribute('aria-label', `Elevador para el comprobante ${appointment.receiptNumber}`);
      select.dataset.liftSelect = appointment.id;
      const candidates = [...appointment.assignableLifts];
      const currentLift = lifts.find((lift) => lift.id === appointment.liftId);
      if (currentLift && !candidates.some((lift) => lift.id === currentLift.id)) candidates.unshift(currentLift);
      select.add(new Option(candidates.length ? 'Elegir elevador' : 'Sin elevadores libres', ''));
      candidates.forEach((lift) => select.add(new Option(lift.name, lift.id)));
      if (appointment.liftId) select.value = appointment.liftId;
      const assign = document.createElement('button');
      assign.type = 'button';
      assign.className = 'accion-asignar-elevador';
      assign.dataset.appointmentId = appointment.id;
      assign.dataset.assignLift = 'true';
      assign.textContent = appointment.liftId ? 'Guardar' : 'Asignar';
      assign.disabled = candidates.length === 0;
      liftCell.append(select, assign);
    } else {
      liftCell.textContent = appointment.liftName || '—';
    }
    row.append(liftCell);

    row.append(cell('', `${appointment.vehicle.make} ${appointment.vehicle.model}`));
    row.append(cell('', appointment.serviceName));

    const status = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `estado-turno estado-${appointment.status}`;
    badge.textContent = statusLabel(appointment.status);
    status.append(badge);
    if (appointment.status === 'confirmado' || appointment.status === 'finalizado') {
      const vehicleStatus = document.createElement('p');
      vehicleStatus.className = 'estado-vehiculo-panel';
      vehicleStatus.textContent = `Vehículo: ${vehicleStatusLabel(appointment.vehicleStatus)}`;
      status.append(vehicleStatus);
      if (appointment.isDelayed) {
        const delay = document.createElement('strong');
        delay.className = 'alerta-demora-panel';
        delay.textContent = 'Demorado (15 min o más)';
        status.append(delay);
      }
    }
    row.append(status);

    const actions = document.createElement('td');
    actions.className = 'acciones-turno-panel';
    if (appointment.status === 'solicitado') {
      const approve = document.createElement('button');
      approve.type = 'button';
      approve.className = 'accion-aprobar';
      approve.dataset.appointmentId = appointment.id;
      approve.dataset.status = 'confirmado';
      approve.textContent = 'Aprobar';
      approve.disabled = !appointment.liftId;
      const reject = document.createElement('button');
      reject.type = 'button';
      reject.className = 'accion-rechazar';
      reject.dataset.appointmentId = appointment.id;
      reject.dataset.status = 'rechazado';
      reject.textContent = 'Rechazar';
      actions.append(approve, reject);
    } else if (appointment.status === 'confirmado') {
      const statusSelect = document.createElement('select');
      statusSelect.className = 'estado-vehiculo-select';
      statusSelect.dataset.vehicleStatusSelect = appointment.id;
      statusSelect.setAttribute('aria-label', `Estado del vehículo ${appointment.vehicle.model}`);
      [['En Taller', 'En Taller'], ['En Reparación', 'En Reparación'], ['Esperando Repuesto', 'Esperando repuesto'], ['Listo para Retirar', 'Listo para retirar']]
        .forEach(([value, label]) => statusSelect.add(new Option(label, value)));
      statusSelect.value = appointment.vehicleStatus || 'En Taller';
      const updateVehicleStatusButton = document.createElement('button');
      updateVehicleStatusButton.type = 'button';
      updateVehicleStatusButton.className = 'accion-actualizar-estado-vehiculo';
      updateVehicleStatusButton.dataset.appointmentId = appointment.id;
      updateVehicleStatusButton.dataset.updateVehicleStatus = 'true';
      updateVehicleStatusButton.textContent = 'Actualizar estado';
      actions.append(statusSelect, updateVehicleStatusButton);
    } else {
      actions.textContent = '—';
    }
    row.append(actions);
    tableBody.append(row);
  });
}

async function loadAppointments() {
  showPanelMessage('Cargando solicitudes…');
  try {
    const response = await fetch('/api/appointments/management', {
      credentials: 'same-origin', headers: { Accept: 'application/json' }
    });
    const result = await response.json();
    if (response.status === 401 || response.status === 403) {
      window.location.replace('pagina1.html');
      return;
    }
    if (!response.ok) throw new Error(result.message || 'No se pudieron cargar las solicitudes.');
    appointments = result.appointments;
    lifts = result.lifts;
    mechanics = result.mechanics;
    if (result.dashboard) renderDashboard(result.dashboard);
    renderLifts();
    renderMechanics();
    updateCounters();
    renderAppointments();
    showPanelMessage(appointments.length ? `${appointments.length} solicitud${appointments.length === 1 ? '' : 'es'} en total.` : 'No hay solicitudes pendientes.');
  } catch (error) {
    showPanelMessage(error.message, true);
  }
}

function formatReportDate(dateValue) {
  const date = new Date(`${dateValue}T12:00:00Z`);
  return new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'full' }).format(date);
}

function renderDailyReport(report) {
  dailyReportRows.replaceChildren();
  if (!report.vehicles.length) {
    const row = document.createElement('tr');
    const empty = document.createElement('td');
    empty.colSpan = 6;
    empty.textContent = 'No hay vehículos ingresados para esta fecha.';
    row.append(empty);
    dailyReportRows.append(row);
  } else {
    report.vehicles.forEach((vehicle) => {
      const row = document.createElement('tr');
      [
        `${vehicle.startTime}–${vehicle.endTime}`,
        `#${vehicle.receiptNumber}`,
        `${vehicle.vehicleModel} · ${vehicle.customerName}`,
        vehicle.serviceName,
        vehicle.liftName,
        vehicle.vehicleStatus
      ].forEach((value) => {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      });
      dailyReportRows.append(row);
    });
  }
  dailyReportMessage.textContent = `${formatReportDate(report.date)} · ${report.totalVehicles} vehículo${report.totalVehicles === 1 ? '' : 's'} ingresado${report.totalVehicles === 1 ? '' : 's'}.`;
}

async function loadDailyReport() {
  const date = document.querySelector('#fecha-reporte-diario').value;
  if (!date) {
    dailyReportMessage.textContent = 'Elegí una fecha válida para consultar el reporte.';
    return;
  }
  dailyReportMessage.textContent = 'Generando reporte…';
  try {
    const response = await fetch(`/api/appointments/management/daily-report?date=${encodeURIComponent(date)}`, {
      credentials: 'same-origin', headers: { Accept: 'application/json' }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'No se pudo generar el reporte diario.');
    renderDailyReport(result);
  } catch (error) {
    dailyReportMessage.textContent = error.message;
  }
}

async function checkManagerSession() {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!response.ok) return window.location.replace('pagina1.html');
    const { user } = await response.json();
    if (user.role !== 'jefe-taller') return window.location.replace(user.role === 'mecanico' ? 'panel-mecanico.html' : 'pagina3.html');
    document.querySelector('#saludo-jefe').textContent = `Hola, ${user.nombre}`;
    return true;
  } catch {
    showPanelMessage('No se pudo conectar con el servidor MotorFix.', true);
    return false;
  }
}

document.querySelector('#actualizar-turnos').addEventListener('click', loadAppointments);
document.querySelector('#actualizar-elevadores').addEventListener('click', loadAppointments);
document.querySelector('#actualizar-mecanicos').addEventListener('click', loadAppointments);
document.querySelector('#actualizar-reporte-diario').addEventListener('click', loadDailyReport);
document.querySelector('#fecha-reporte-diario').addEventListener('change', loadDailyReport);
document.querySelector('.panel-jefe-filtros').addEventListener('click', (event) => {
  const button = event.target.closest('[data-filtro]');
  if (!button) return;
  activeFilter = button.dataset.filtro;
  document.querySelectorAll('.filtro-turno').forEach((filter) => {
    const isActive = filter === button;
    filter.classList.toggle('activo', isActive);
    filter.setAttribute('aria-pressed', String(isActive));
  });
  renderAppointments();
});

tableBody.addEventListener('click', async (event) => {
  const vehicleStatusButton = event.target.closest('[data-appointment-id][data-update-vehicle-status]');
  if (vehicleStatusButton) {
    const select = [...tableBody.querySelectorAll('[data-vehicle-status-select]')]
      .find((item) => item.dataset.vehicleStatusSelect === vehicleStatusButton.dataset.appointmentId);
    if (!select) return;
    vehicleStatusButton.disabled = true;
    showPanelMessage('Actualizando estado del vehículo…');
    try {
      const response = await fetch(`/api/appointments/management/${encodeURIComponent(vehicleStatusButton.dataset.appointmentId)}/vehicle-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ vehicleStatus: select.value })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'No se pudo actualizar el estado del vehículo.');
      await loadAppointments();
      showPanelMessage(result.message);
    } catch (error) {
      showPanelMessage(error.message, true);
      vehicleStatusButton.disabled = false;
    }
    return;
  }
  const button = event.target.closest('[data-appointment-id][data-assign-lift]');
  if (button) {
    const select = [...tableBody.querySelectorAll('[data-lift-select]')]
      .find((item) => item.dataset.liftSelect === button.dataset.appointmentId);
    if (!select?.value) return showPanelMessage('Elegí un elevador antes de asignarlo.', true);
    button.disabled = true;
    showPanelMessage('Asignando elevador…');
    try {
      const response = await fetch(`/api/appointments/management/${encodeURIComponent(button.dataset.appointmentId)}/lift`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ liftId: select.value })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'No se pudo asignar el elevador.');
      await loadAppointments();
      showPanelMessage('Elevador asignado correctamente.');
    } catch (error) {
      showPanelMessage(error.message, true);
      button.disabled = false;
    }
    return;
  }
  const statusButton = event.target.closest('[data-appointment-id][data-status]');
  if (!statusButton) return;
  const statusAction = statusButton;
  statusAction.disabled = true;
  const statusMessages = { confirmado: 'Aprobando el turno…', rechazado: 'Rechazando la solicitud…', finalizado: 'Marcando el trabajo como finalizado…' };
  showPanelMessage(statusMessages[statusAction.dataset.status]);
  try {
    const response = await fetch(`/api/appointments/management/${encodeURIComponent(statusAction.dataset.appointmentId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ status: statusAction.dataset.status })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'No se pudo actualizar el turno.');
    await loadAppointments();
    if (statusAction.dataset.status === 'finalizado') showPanelMessage('Trabajo marcado como finalizado. El cliente ya puede verlo en su panel.');
  } catch (error) {
    showPanelMessage(error.message, true);
    statusAction.disabled = false;
  }
});

liftsContainer.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-lift-id]');
  if (!button) return;
  const enabled = button.dataset.enabled === 'true';
  button.disabled = true;
  showLiftMessage(enabled ? 'Habilitando elevador…' : 'Deshabilitando elevador…');
  try {
    const response = await fetch(`/api/appointments/management/lifts/${encodeURIComponent(button.dataset.liftId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ enabled })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'No se pudo cambiar el estado del elevador.');
    await loadAppointments();
    showLiftMessage(result.message);
  } catch (error) {
    showLiftMessage(error.message, true);
    button.disabled = false;
  }
});

mechanicsContainer.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-mechanic-id]');
  if (!button) return;
  const select = [...mechanicsContainer.querySelectorAll('[data-mechanic-select]')]
    .find((item) => item.dataset.mechanicSelect === button.dataset.mechanicId);
  if (!select?.value) return showMechanicMessage('Elegí un elevador para el mecánico.', true);
  button.disabled = true;
  showMechanicMessage('Actualizando asignación…');
  try {
    const response = await fetch(`/api/appointments/management/mechanics/${encodeURIComponent(button.dataset.mechanicId)}/lift`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ liftId: select.value })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'No se pudo actualizar la asignación.');
    await loadAppointments();
    showMechanicMessage(result.message);
  } catch (error) {
    showMechanicMessage(error.message, true);
    button.disabled = false;
  }
});

document.querySelector('#cerrar-sesion').addEventListener('click', async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } finally {
    window.location.replace('pagina1.html');
  }
});

checkManagerSession().then((isManager) => {
  if (!isManager) return;
  const now = new Date();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  document.querySelector('#fecha-reporte-diario').value = today;
  loadAppointments();
  loadDailyReport();
});
window.setInterval(() => {
  if (document.visibilityState === 'visible') loadAppointments();
}, 30000);
