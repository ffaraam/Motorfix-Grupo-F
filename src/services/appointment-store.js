const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { readUsers, updateMechanicLift: saveMechanicLift } = require('./user-store');

const dataDirectory = path.join(__dirname, '..', '..', 'data');
const configDirectory = path.join(__dirname, '..', '..', 'config');
const appointmentsFile = path.join(dataDirectory, 'appointments.json');
const servicesFile = path.join(dataDirectory, 'services.json');
const workshopFile = path.join(dataDirectory, 'workshop.json');
let writeQueue = Promise.resolve();
let reservationQueue = Promise.resolve();

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function writeJsonAtomic(file, data) {
  const temporaryFile = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporaryFile, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temporaryFile, file);
}

async function ensureFile(file, initialValue) {
  try {
    await fs.access(file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeJsonAtomic(file, initialValue);
  }
}

async function ensureAppointmentStore() {
  await fs.mkdir(dataDirectory, { recursive: true });
  const defaultServices = await readJson(path.join(configDirectory, 'services.json'));
  const defaultWorkshop = await readJson(path.join(configDirectory, 'workshop.json'));
  await Promise.all([
    ensureFile(servicesFile, defaultServices),
    ensureFile(workshopFile, defaultWorkshop),
    ensureFile(appointmentsFile, [])
  ]);
}

async function getServices() {
  return readJson(servicesFile);
}

async function getWorkshop() {
  return readJson(workshopFile);
}

function updateWorkshopSettings(input) {
  const operation = reservationQueue.then(async () => {
    const [services, workshop] = await Promise.all([getServices(), getWorkshop()]);
    const submittedServices = input?.services;
    const submittedWorkshop = input?.workshop;

    if (!Array.isArray(submittedServices) || submittedServices.length !== services.length || !submittedWorkshop || typeof submittedWorkshop !== 'object') {
      throw Object.assign(new Error('La configuración enviada está incompleta.'), { code: 'INVALID' });
    }

    const byId = new Map(submittedServices.map((service) => [service?.id, service]));
    const updatedServices = services.map((current) => {
      const submitted = byId.get(current.id);
      if (!submitted || typeof submitted.enabled !== 'boolean' || typeof submitted.suppliesAvailable !== 'boolean') {
        throw Object.assign(new Error('Revisá la disponibilidad y los insumos de cada servicio.'), { code: 'INVALID' });
      }
      const name = String(submitted.name || '').trim();
      const description = String(submitted.description || '').trim();
      const price = Number(submitted.estimatedPrice);
      const duration = Number(submitted.durationMinutes);
      if (!name || name.length > 100 || description.length > 500 || !Number.isFinite(price) || price < 0 || price > 100000000
        || !Number.isInteger(duration) || duration < 15 || duration > 1440) {
        throw Object.assign(new Error('Cada servicio requiere nombre, precio y duración válidos.'), { code: 'INVALID' });
      }
      return { ...current, name, description, estimatedPrice: price, durationMinutes: duration, enabled: submitted.enabled, suppliesAvailable: submitted.suppliesAvailable };
    });

    const openingTime = submittedWorkshop.openingTime;
    const closingTime = submittedWorkshop.closingTime;
    const businessDays = submittedWorkshop.businessDays;
    const slotIntervalMinutes = Number(submittedWorkshop.slotIntervalMinutes);
    const maxDailyAppointments = Number(submittedWorkshop.maxDailyAppointments);
    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    const minutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
    if (!timePattern.test(openingTime || '') || !timePattern.test(closingTime || '') || minutes(closingTime) <= minutes(openingTime)
      || !Array.isArray(businessDays) || !businessDays.length || businessDays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)
      || new Set(businessDays).size !== businessDays.length || !Number.isInteger(slotIntervalMinutes) || slotIntervalMinutes < 15 || slotIntervalMinutes > 240
      || !Number.isInteger(maxDailyAppointments) || maxDailyAppointments < 1 || maxDailyAppointments > 100) {
      throw Object.assign(new Error('Revisá los días, el horario de atención y la capacidad diaria.'), { code: 'INVALID' });
    }

    const updatedWorkshop = { ...workshop, openingTime, closingTime, businessDays: [...businessDays].sort(), slotIntervalMinutes, maxDailyAppointments };
    const tempServices = `${servicesFile}.${process.pid}.${Date.now()}.tmp`;
    const tempWorkshop = `${workshopFile}.${process.pid}.${Date.now()}.tmp`;
    try {
      await Promise.all([
        fs.writeFile(tempServices, `${JSON.stringify(updatedServices, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 }),
        fs.writeFile(tempWorkshop, `${JSON.stringify(updatedWorkshop, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
      ]);
      await fs.rename(tempServices, servicesFile);
      await fs.rename(tempWorkshop, workshopFile);
    } catch (error) {
      await Promise.all([fs.rm(tempServices, { force: true }), fs.rm(tempWorkshop, { force: true })]);
      throw error;
    }
    return { services: updatedServices, workshop: updatedWorkshop };
  });
  reservationQueue = operation.catch(() => {});
  return operation;
}

async function readAppointments() {
  return readJson(appointmentsFile);
}

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toISOString().slice(0, 10) === value ? date : null;
}

function localDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

function getService(services, serviceId) {
  return services.find((service) => service.id === serviceId);
}

function estimateTotal(service, workshop) {
  if (service.estimatedPrice == null || workshop.quoteBase == null) return null;
  return Number((Number(service.estimatedPrice) + Number(workshop.quoteBase)).toFixed(2));
}

function getQuoteStatus(service, workshop) {
  if (estimateTotal(service, workshop) == null) return 'pendiente';
  return workshop.quoteBaseIsSymbolic || service.estimatedPriceIsSymbolic ? 'provisoria' : 'definitiva';
}

const VEHICLE_STATUSES = ['En Taller', 'En Reparación', 'Esperando Repuesto', 'Listo para Retirar'];
const DELAY_GRACE_MINUTES = 15;

function getVehicleStatusDetails(appointment, timeZone, now = new Date()) {
  const status = VEHICLE_STATUSES.includes(appointment.vehicleStatus) ? appointment.vehicleStatus : null;
  const [year, month, day] = appointment.date.split('-').map(Number);
  const [hours, minutes] = appointment.startTime.split(':').map(Number);
  const scheduledStart = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  const workshopTime = localDateParts(scheduledStart, timeZone);
  const offsetMinutes = Date.UTC(year, month - 1, day, hours, minutes)
    - Date.UTC(Number(workshopTime.year), Number(workshopTime.month) - 1, Number(workshopTime.day), Number(workshopTime.hour), Number(workshopTime.minute));
  scheduledStart.setTime(scheduledStart.getTime() + offsetMinutes);
  const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - scheduledStart.getTime()) / 60000));
  const estimatedDuration = Number(appointment.durationMinutes);
  const delayed = appointment.status === 'confirmado'
    && status !== 'Listo para Retirar'
    && Number.isFinite(estimatedDuration)
    && elapsedMinutes >= estimatedDuration + DELAY_GRACE_MINUTES;
  return {
    vehicleStatus: status,
    vehicleStatusUpdatedAt: appointment.vehicleStatusUpdatedAt || null,
    isDelayed: delayed,
    delayThresholdMinutes: Number.isFinite(estimatedDuration) ? estimatedDuration + DELAY_GRACE_MINUTES : null
  };
}

function countsTowardDailyLimit(appointment) {
  return ['solicitado', 'confirmado'].includes(appointment.status);
}

function slotIsAvailable({ service, date, startTime, workshop, appointments }) {
  const opening = toMinutes(workshop.openingTime);
  const closing = toMinutes(workshop.closingTime);
  const start = toMinutes(startTime);
  const end = start + service.durationMinutes;
  if (!Number.isInteger(start) || start < opening || (start - opening) % workshop.slotIntervalMinutes !== 0 || end > closing) return false;
  const active = appointments.filter((appointment) => appointment.date === date
    && countsTowardDailyLimit(appointment)
    && start < toMinutes(appointment.endTime)
    && end > toMinutes(appointment.startTime));
  const enabledLifts = workshop.lifts.filter((lift) => lift.enabled !== false);
  const assignedLiftIds = new Set(active.map((appointment) => appointment.liftId).filter(Boolean));
  const unassignedCount = active.filter((appointment) => !appointment.liftId).length;
  return enabledLifts.length - assignedLiftIds.size > unassignedCount;
}

function toMinutes(time) {
  if (!/^\d{2}:\d{2}$/.test(time || '')) return NaN;
  const [hours, minutes] = time.split(':').map(Number);
  if (hours > 23 || minutes > 59) return NaN;
  return hours * 60 + minutes;
}

function validateBookingDate(date, workshop) {
  const parsedDate = parseDate(date);
  if (!parsedDate) return { code: 'INVALID', message: 'La fecha no tiene un formato válido.' };

  const today = localDateParts(new Date(), workshop.timeZone);
  const todayString = `${today.year}-${today.month}-${today.day}`;
  if (date < todayString) return { code: 'NOT_BOOKABLE', message: 'Elegí una fecha de hoy en adelante.' };

  const weekday = parsedDate.getUTCDay() || 7;
  if (!workshop.businessDays.includes(weekday)) return { code: 'NOT_BOOKABLE', message: 'El taller no recibe vehículos ese día.' };

  if (date === todayString) {
    const localNow = localDateParts(new Date(), workshop.timeZone);
    const currentMinute = Number(localNow.hour) * 60 + Number(localNow.minute);
    if (currentMinute >= toMinutes(workshop.closingTime)) return { code: 'NOT_BOOKABLE', message: 'Ya no quedan horarios para hoy.' };
  }
  return null;
}

async function getAvailability(serviceId, date) {
  const [services, workshop, appointments] = await Promise.all([getServices(), getWorkshop(), readAppointments()]);
  const service = getService(services, serviceId);
  if (!service) {
    const error = new Error('No encontramos ese servicio.');
    error.code = 'NOT_BOOKABLE';
    throw error;
  }
  if (!service.enabled || !service.suppliesAvailable) {
    const error = new Error('Este servicio no está disponible para nuevas solicitudes por el momento.');
    error.code = 'NOT_BOOKABLE';
    throw error;
  }
  const dateError = validateBookingDate(date, workshop);
  if (dateError) {
    const error = new Error(dateError.message);
    error.code = dateError.code;
    throw error;
  }

  const firstStart = toMinutes(workshop.openingTime);
  const lastStart = toMinutes(workshop.closingTime) - service.durationMinutes;
  const dailyCount = appointments.filter((appointment) => appointment.date === date && countsTowardDailyLimit(appointment)).length;
  const dailyCapacity = Number(workshop.maxDailyAppointments) || Infinity;
  const dailyRemaining = Math.max(0, dailyCapacity - dailyCount);
  const today = localDateParts(new Date(), workshop.timeZone);
  const isToday = date === `${today.year}-${today.month}-${today.day}`;
  const currentMinute = Number(today.hour) * 60 + Number(today.minute);
  const options = [];

  for (let start = firstStart; dailyRemaining > 0 && start <= lastStart; start += workshop.slotIntervalMinutes) {
    if (isToday && start <= currentMinute) continue;
    const startTime = minutesToTime(start);
    const endTime = minutesToTime(start + service.durationMinutes);
    if (slotIsAvailable({ service, date, startTime, workshop, appointments })) options.push({ startTime, endTime });
  }

  return {
    service: { id: service.id, name: service.name, durationMinutes: service.durationMinutes },
    date,
    timeZone: workshop.timeZone,
    quote: { estimatedTotal: estimateTotal(service, workshop), currency: workshop.currency || 'ARS', status: getQuoteStatus(service, workshop) },
    dailyCapacity: { limit: dailyCapacity, remaining: dailyRemaining },
    options
  };
}

function minutesToTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function createAppointment(input, userId) {
  const operation = reservationQueue.then(async () => {
    const [services, workshop] = await Promise.all([getServices(), getWorkshop()]);
    const service = getService(services, input.serviceId);
    if (!service) throw Object.assign(new Error('No encontramos ese servicio.'), { code: 'NOT_BOOKABLE' });
    if (!service.enabled || !service.suppliesAvailable) {
      throw Object.assign(new Error('Este servicio no está disponible para nuevas solicitudes por el momento.'), { code: 'NOT_BOOKABLE' });
    }
    const make = typeof input.vehicle?.make === 'string' ? input.vehicle.make.trim() : '';
    const model = typeof input.vehicle?.model === 'string' ? input.vehicle.model.trim() : '';
    if (make.length < 1 || make.length > 50 || model.length < 1 || model.length > 50) {
      throw Object.assign(new Error('Ingresá la marca y el modelo del vehículo.'), { code: 'INVALID' });
    }
    const dateError = validateBookingDate(input.date, workshop);
    if (dateError) throw Object.assign(new Error(dateError.message), { code: dateError.code });

    if (!/^\d{2}:\d{2}$/.test(input.startTime || '') || !Number.isFinite(service.durationMinutes) || service.durationMinutes <= 0) {
      throw Object.assign(new Error('El horario seleccionado no es válido.'), { code: 'INVALID' });
    }

    const appointments = await readAppointments();
    const dailyCapacity = Number(workshop.maxDailyAppointments) || Infinity;
    const dailyCount = appointments.filter((appointment) => appointment.date === input.date && countsTowardDailyLimit(appointment)).length;
    if (dailyCount >= dailyCapacity) {
      throw Object.assign(new Error(`El taller ya alcanzó el límite de ${dailyCapacity} turnos para esa fecha.`), { code: 'DAILY_CAPACITY' });
    }
    if (!slotIsAvailable({ service, date: input.date, startTime: input.startTime, workshop, appointments })) {
      throw Object.assign(new Error('Ya no hay capacidad disponible en ese horario. Actualizamos las opciones para que elijas otro.'), { code: 'BOOKING_CONFLICT' });
    }

    const endTime = minutesToTime(toMinutes(input.startTime) + service.durationMinutes);
    const quote = estimateTotal(service, workshop);
    const appointment = {
      id: randomUUID(),
      userId,
      serviceId: service.id,
      serviceName: service.name,
      vehicle: { make, model },
      date: input.date,
      startTime: input.startTime,
      endTime,
      durationMinutes: service.durationMinutes,
      liftId: null,
      liftName: null,
      estimatedTotal: quote,
      quoteStatus: getQuoteStatus(service, workshop),
      currency: workshop.currency || 'ARS',
      status: 'solicitado',
      createdAt: new Date().toISOString()
    };
    appointments.push(appointment);
    await writeQueue;
    const writeOperation = writeJsonAtomic(appointmentsFile, appointments);
    writeQueue = writeOperation.catch(() => {});
    await writeOperation;
    return appointment;
  });
  reservationQueue = operation.catch(() => {});
  return operation;
}

async function listAppointmentsForUser(userId) {
  const [appointments, workshop] = await Promise.all([readAppointments(), getWorkshop()]);
  return appointments
    .filter((appointment) => appointment.userId === userId)
    .map((appointment) => ({ ...appointment, ...getVehicleStatusDetails(appointment, workshop.timeZone) }))
    .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
}

function getAppointmentStartDate(appointment, timeZone) {
  const [year, month, day] = appointment.date.split('-').map(Number);
  const [hours, minutes] = appointment.startTime.split(':').map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  const local = localDateParts(utcGuess, timeZone);
  const offset = Date.UTC(year, month - 1, day, hours, minutes)
    - Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day), Number(local.hour), Number(local.minute));
  return new Date(utcGuess.getTime() + offset);
}

function cancelAppointment(appointmentId, userId) {
  const operation = reservationQueue.then(async () => {
    const [appointments, workshop] = await Promise.all([readAppointments(), getWorkshop()]);
    const appointment = appointments.find((item) => item.id === appointmentId && item.userId === userId);
    if (!appointment) throw Object.assign(new Error('No encontramos ese turno en tu cuenta.'), { code: 'NOT_FOUND' });
    if (appointment.status !== 'solicitado' && appointment.status !== 'confirmado') {
      throw Object.assign(new Error('Solo podés cancelar solicitudes pendientes o turnos aprobados.'), { code: 'NOT_CANCELLABLE' });
    }
    const cutoffHours = Number(workshop.cancellationCutoffHours) || 2;
    const now = new Date();
    now.setSeconds(0, 0);
    const minutesUntilStart = (getAppointmentStartDate(appointment, workshop.timeZone).getTime() - now.getTime()) / 60000;
    if (minutesUntilStart < cutoffHours * 60) {
      throw Object.assign(new Error(`Podés cancelar hasta ${cutoffHours} horas antes del turno.`), { code: 'CANCELLATION_CUTOFF' });
    }
    const cancelledAt = new Date().toISOString();
    appointment.status = 'cancelado';
    appointment.cancelledAt = cancelledAt;
    appointment.cancelledBy = userId;
    appointment.updatedAt = cancelledAt;
    const writeOperation = writeJsonAtomic(appointmentsFile, appointments);
    writeQueue = writeOperation.catch(() => {});
    await writeOperation;
    return appointment;
  });
  reservationQueue = operation.catch(() => {});
  return operation;
}

async function getDailyVehicleReport(date) {
  const [appointments, users, workshop] = await Promise.all([readAppointments(), readUsers(), getWorkshop()]);
  const parts = date ? parseDate(date) : null;
  if (date && !parts) throw Object.assign(new Error('La fecha del reporte no es válida.'), { code: 'INVALID' });
  const now = localDateParts(new Date(), workshop.timeZone);
  const reportDate = date || `${now.year}-${now.month}-${now.day}`;
  const usersById = new Map(users.map((user) => [user.id, user]));
  const vehicles = appointments
    .filter((appointment) => appointment.date === reportDate
      && (appointment.status === 'finalizado' || appointment.status === 'confirmado' && appointment.vehicleStatus !== 'Listo para Retirar'))
    .map((appointment) => ({
      receiptNumber: appointment.id.slice(0, 8).toUpperCase(),
      customerName: usersById.get(appointment.userId)?.nombre || 'Cliente no disponible',
      vehicleModel: appointment.vehicle?.model || 'Modelo no informado',
      serviceName: appointment.serviceName,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      liftName: appointment.liftName || 'Sin elevador asignado',
      vehicleStatus: appointment.vehicleStatus || (appointment.status === 'finalizado' ? 'Listo para Retirar' : 'En Taller'),
      status: appointment.status
    }))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  return { date: reportDate, totalVehicles: vehicles.length, vehicles };
}

async function listAppointmentsForManagement() {
  const [appointments, users, workshop] = await Promise.all([readAppointments(), readUsers(), getWorkshop()]);
  const usersById = new Map(users.map((user) => [user.id, user]));
  return appointments
    .map((appointment) => {
      const customer = usersById.get(appointment.userId);
      const start = toMinutes(appointment.startTime);
      const end = toMinutes(appointment.endTime);
      const overlapping = appointments.filter((other) => other.id !== appointment.id
        && other.date === appointment.date
        && countsTowardDailyLimit(other)
        && start < toMinutes(other.endTime)
        && end > toMinutes(other.startTime));
      const occupiedLifts = new Set(overlapping.map((other) => other.liftId).filter(Boolean));
      const unassignedCount = overlapping.filter((other) => !other.liftId).length;
      const freeCapacity = workshop.lifts.filter((lift) => lift.enabled !== false).length - occupiedLifts.size;
      const assignableLifts = workshop.lifts.filter((lift) => lift.enabled !== false
        && !occupiedLifts.has(lift.id)
        && freeCapacity > unassignedCount);
      return {
        ...appointment,
        ...getVehicleStatusDetails(appointment, workshop.timeZone),
        receiptNumber: appointment.id.slice(0, 8).toUpperCase(),
        customer: customer ? { name: customer.nombre, email: customer.email, phone: customer.telefono || '' } : { name: 'Cuenta no disponible', email: '', phone: '' },
        assignableLifts: countsTowardDailyLimit(appointment) ? assignableLifts : []
      };
    })
    .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
}

async function getWorkshopDashboard() {
  const [appointments, services, users, workshop] = await Promise.all([
    readAppointments(), getServices(), readUsers(), getWorkshop()
  ]);
  const nowParts = localDateParts(new Date(), workshop.timeZone);
  const today = `${nowParts.year}-${nowParts.month}-${nowParts.day}`;
  const currentMinute = Number(nowParts.hour) * 60 + Number(nowParts.minute);
  const activeToday = appointments.filter((appointment) => appointment.date === today && countsTowardDailyLimit(appointment));
  const demandCounts = new Map();
  appointments.filter((appointment) => appointment.date === today && appointment.status !== 'cancelado').forEach((appointment) => {
    demandCounts.set(appointment.serviceId, (demandCounts.get(appointment.serviceId) || 0) + 1);
  });
  const mostDemandedServices = services
    .map((service) => ({ id: service.id, name: service.name, appointments: demandCounts.get(service.id) || 0 }))
    .sort((a, b) => b.appointments - a.appointments || a.name.localeCompare(b.name, 'es'));
  const mechanics = users.filter((user) => user.role === 'mecanico');
  const mechanicsAvailability = mechanics.map((mechanic) => {
    const activeLift = workshop.lifts.find((item) => item.id === mechanic.liftId);
    const activeJob = activeToday.find((appointment) => appointment.status === 'confirmado'
      && appointment.liftId === mechanic.liftId
      && appointment.vehicleStatus !== 'Listo para Retirar'
      && currentMinute >= toMinutes(appointment.startTime)
      && currentMinute < toMinutes(appointment.endTime));
    const available = !activeJob && activeLift?.enabled !== false;
    return { id: mechanic.id, name: mechanic.nombre, liftId: mechanic.liftId, liftName: activeLift?.name || 'Sin elevador', available };
  });
  return {
    date: today,
    mostDemandedServices,
    mechanics: {
      available: mechanicsAvailability.filter((mechanic) => mechanic.available).length,
      total: mechanicsAvailability.length,
      list: mechanicsAvailability
    }
  };
}

async function listAppointmentsForMechanic(userId) {
  const [appointments, users, workshop] = await Promise.all([readAppointments(), readUsers(), getWorkshop()]);
  const mechanic = users.find((user) => user.id === userId && user.role === 'mecanico');
  if (!mechanic) throw Object.assign(new Error('No encontramos la cuenta del mecánico.'), { code: 'NOT_FOUND' });
  const lift = workshop.lifts.find((item) => item.id === mechanic.liftId);
  const now = localDateParts(new Date(), workshop.timeZone);
  const today = `${now.year}-${now.month}-${now.day}`;
  const currentMinute = Number(now.hour) * 60 + Number(now.minute);
  const usersById = new Map(users.map((user) => [user.id, user]));
  const jobs = appointments
    .filter((appointment) => appointment.liftId === mechanic.liftId
      && appointment.status === 'confirmado'
      && (appointment.date > today || (appointment.date === today && toMinutes(appointment.endTime) > currentMinute)))
    .map((appointment) => ({
      receiptNumber: appointment.id.slice(0, 8).toUpperCase(),
      serviceName: appointment.serviceName,
      vehicleModel: appointment.vehicle?.model || 'Modelo no informado',
      customerName: usersById.get(appointment.userId)?.nombre || 'Cliente no disponible',
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      durationMinutes: appointment.durationMinutes,
      ...getVehicleStatusDetails(appointment, workshop.timeZone)
    }))
    .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
  return {
    mechanic: { name: mechanic.nombre, liftId: mechanic.liftId, liftName: lift?.name || 'Elevador sin configurar' },
    appointments: jobs
  };
}

async function getManagementLiftStatuses() {
  const [workshop, appointments] = await Promise.all([getWorkshop(), readAppointments()]);
  const now = localDateParts(new Date(), workshop.timeZone);
  const today = `${now.year}-${now.month}-${now.day}`;
  const currentMinute = Number(now.hour) * 60 + Number(now.minute);
  return workshop.lifts.map((lift) => {
    const currentAppointment = appointments.find((appointment) => appointment.date === today
      && appointment.liftId === lift.id
      && countsTowardDailyLimit(appointment)
      && currentMinute >= toMinutes(appointment.startTime)
      && currentMinute < toMinutes(appointment.endTime));
    return {
      ...lift,
      status: lift.enabled === false ? 'deshabilitado' : currentAppointment ? 'ocupado' : 'disponible',
      appointment: currentAppointment ? {
        id: currentAppointment.id,
        serviceName: currentAppointment.serviceName,
        startTime: currentAppointment.startTime,
        endTime: currentAppointment.endTime
      } : null
    };
  });
}

async function listMechanicsForManagement() {
  const users = await readUsers();
  return users
    .filter((user) => user.role === 'mecanico')
    .map((user) => ({ id: user.id, name: user.nombre, email: user.email, liftId: user.liftId }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

function assignMechanicToLift(mechanicId, liftId) {
  const operation = reservationQueue.then(async () => {
    const workshop = await getWorkshop();
    const lift = workshop.lifts.find((item) => item.id === liftId);
    if (!lift) throw Object.assign(new Error('No encontramos ese elevador.'), { code: 'NOT_FOUND' });
    if (lift.enabled === false) throw Object.assign(new Error('Habilitá el elevador antes de asignarle un mecánico.'), { code: 'LIFT_UNAVAILABLE' });
    return saveMechanicLift(mechanicId, liftId);
  });
  reservationQueue = operation.catch(() => {});
  return operation;
}

function updateAppointmentLift(appointmentId, liftId) {
  const operation = reservationQueue.then(async () => {
    const [appointments, workshop] = await Promise.all([readAppointments(), getWorkshop()]);
    const appointment = appointments.find((item) => item.id === appointmentId);
    if (!appointment) throw Object.assign(new Error('No encontramos ese turno.'), { code: 'NOT_FOUND' });
    if (!countsTowardDailyLimit(appointment)) {
      throw Object.assign(new Error('Solo podés asignar elevadores a solicitudes pendientes o aprobadas.'), { code: 'NOT_ASSIGNABLE' });
    }
    const lift = workshop.lifts.find((item) => item.id === liftId);
    if (!lift || lift.enabled === false) throw Object.assign(new Error('Ese elevador no está habilitado.'), { code: 'LIFT_UNAVAILABLE' });

    const start = toMinutes(appointment.startTime);
    const end = toMinutes(appointment.endTime);
    const overlapping = appointments.filter((other) => other.id !== appointment.id
      && other.date === appointment.date
      && countsTowardDailyLimit(other)
      && start < toMinutes(other.endTime)
      && end > toMinutes(other.startTime));
    if (overlapping.some((other) => other.liftId === liftId)) {
      throw Object.assign(new Error('Ese elevador ya tiene un turno en ese horario.'), { code: 'LIFT_UNAVAILABLE' });
    }
    const enabledCount = workshop.lifts.filter((item) => item.enabled !== false).length;
    const occupiedCount = new Set(overlapping.map((item) => item.liftId).filter(Boolean)).size;
    const unassignedCount = overlapping.filter((item) => !item.liftId).length;
    if (enabledCount - occupiedCount <= unassignedCount) {
      throw Object.assign(new Error('La capacidad de ese horario ya quedó reservada por otras solicitudes.'), { code: 'LIFT_UNAVAILABLE' });
    }

    appointment.liftId = lift.id;
    appointment.liftName = lift.name;
    appointment.updatedAt = new Date().toISOString();
    const writeOperation = writeJsonAtomic(appointmentsFile, appointments);
    writeQueue = writeOperation.catch(() => {});
    await writeOperation;
    return appointment;
  });
  reservationQueue = operation.catch(() => {});
  return operation;
}

function updateLiftEnabled(liftId, enabled) {
  const operation = reservationQueue.then(async () => {
    if (typeof enabled !== 'boolean') throw Object.assign(new Error('Indicá si el elevador queda habilitado o deshabilitado.'), { code: 'INVALID' });
    const workshop = await getWorkshop();
    const lift = workshop.lifts.find((item) => item.id === liftId);
    if (!lift) throw Object.assign(new Error('No encontramos ese elevador.'), { code: 'NOT_FOUND' });
    if (!enabled && lift.enabled !== false) {
      const appointments = await readAppointments();
      const now = localDateParts(new Date(), workshop.timeZone);
      const today = `${now.year}-${now.month}-${now.day}`;
      const currentMinute = Number(now.hour) * 60 + Number(now.minute);
      const hasFutureAssignment = appointments.some((appointment) => appointment.liftId === lift.id
        && countsTowardDailyLimit(appointment)
        && (appointment.date > today || (appointment.date === today && toMinutes(appointment.endTime) > currentMinute)));
      if (hasFutureAssignment) {
        throw Object.assign(new Error('Reasigná los turnos activos de este elevador antes de deshabilitarlo.'), { code: 'LIFT_HAS_APPOINTMENTS' });
      }
    }
    lift.enabled = enabled;
    const writeOperation = writeJsonAtomic(workshopFile, workshop);
    writeQueue = writeOperation.catch(() => {});
    await writeOperation;
    return lift;
  });
  reservationQueue = operation.catch(() => {});
  return operation;
}

function updateAppointmentStatus(appointmentId, status, managerId) {
  const operation = reservationQueue.then(async () => {
    if (!['confirmado', 'rechazado', 'finalizado'].includes(status)) {
      throw Object.assign(new Error('El estado solicitado no es válido.'), { code: 'INVALID' });
    }
    const appointments = await readAppointments();
    const appointment = appointments.find((item) => item.id === appointmentId);
    if (!appointment) throw Object.assign(new Error('No encontramos ese turno.'), { code: 'NOT_FOUND' });
    if (status === 'finalizado') {
      if (appointment.status !== 'confirmado') {
        throw Object.assign(new Error('Solo podés finalizar un turno aprobado.'), { code: 'ALREADY_REVIEWED' });
      }
      const completedAt = new Date().toISOString();
      appointment.status = 'finalizado';
      appointment.vehicleStatus = 'Listo para Retirar';
      appointment.vehicleStatusUpdatedAt = completedAt;
      appointment.completedBy = managerId;
      appointment.completedAt = completedAt;
      appointment.updatedAt = appointment.completedAt;
      const writeOperation = writeJsonAtomic(appointmentsFile, appointments);
      writeQueue = writeOperation.catch(() => {});
      await writeOperation;
      return appointment;
    }
    if (appointment.status !== 'solicitado') {
      throw Object.assign(new Error('Esta solicitud ya fue revisada.'), { code: 'ALREADY_REVIEWED' });
    }
    if (status === 'confirmado' && !appointment.liftId) {
      throw Object.assign(new Error('Asigná un elevador antes de aprobar este turno.'), { code: 'LIFT_REQUIRED' });
    }
    appointment.status = status;
    appointment.reviewedBy = managerId;
    appointment.reviewedAt = new Date().toISOString();
    appointment.updatedAt = appointment.reviewedAt;
    const writeOperation = writeJsonAtomic(appointmentsFile, appointments);
    writeQueue = writeOperation.catch(() => {});
    await writeOperation;
    return appointment;
  });
  reservationQueue = operation.catch(() => {});
  return operation;
}

function updateVehicleStatus(appointmentId, status, managerId) {
  const operation = reservationQueue.then(async () => {
    if (!VEHICLE_STATUSES.includes(status)) {
      throw Object.assign(new Error('Elegí un estado válido para el vehículo.'), { code: 'INVALID' });
    }
    const appointments = await readAppointments();
    const appointment = appointments.find((item) => item.id === appointmentId);
    if (!appointment) throw Object.assign(new Error('No encontramos ese turno.'), { code: 'NOT_FOUND' });
    if (appointment.status !== 'confirmado' && !(appointment.status === 'finalizado' && status === 'Listo para Retirar')) {
      throw Object.assign(new Error('Solo podés actualizar el estado de un trabajo aprobado.'), { code: 'ALREADY_REVIEWED' });
    }
    const updatedAt = new Date().toISOString();
    appointment.vehicleStatus = status;
    appointment.vehicleStatusUpdatedAt = updatedAt;
    appointment.vehicleStatusUpdatedBy = managerId;
    if (status === 'Listo para Retirar' && appointment.status === 'confirmado') {
      appointment.status = 'finalizado';
      appointment.completedBy = managerId;
      appointment.completedAt = updatedAt;
    }
    appointment.updatedAt = updatedAt;
    const writeOperation = writeJsonAtomic(appointmentsFile, appointments);
    writeQueue = writeOperation.catch(() => {});
    await writeOperation;
    return appointment;
  });
  reservationQueue = operation.catch(() => {});
  return operation;
}

module.exports = {
  createAppointment,
  ensureAppointmentStore,
  getAvailability,
  getManagementLiftStatuses,
  getWorkshopDashboard,
  getServices,
  getWorkshop,
  updateWorkshopSettings,
  listMechanicsForManagement,
  listAppointmentsForMechanic,
  listAppointmentsForManagement,
  listAppointmentsForUser,
  cancelAppointment,
  getDailyVehicleReport,
  updateAppointmentStatus,
  updateVehicleStatus,
  updateAppointmentLift,
  updateLiftEnabled,
  assignMechanicToLift
};
