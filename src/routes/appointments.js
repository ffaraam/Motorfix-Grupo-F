const express = require('express');
const { requireAuth, requireRole } = require('../middleware/require-auth');
const {
  createAppointment,
  getAvailability,
  getManagementLiftStatuses,
  getServices,
  getWorkshop,
  listMechanicsForManagement,
  listAppointmentsForMechanic,
  listAppointmentsForManagement,
  listAppointmentsForUser,
  updateAppointmentStatus,
  updateAppointmentLift,
  updateLiftEnabled,
  assignMechanicToLift
} = require('../services/appointment-store');

const appointmentsRouter = express.Router();
appointmentsRouter.use(requireAuth);

function requireJson(req, res, next) {
  if (!req.is('application/json')) {
    return res.status(415).json({ message: 'La solicitud debe enviarse en formato JSON.' });
  }
  return next();
}

function sendAppointmentError(error, res, next) {
  if (error.code === 'INVALID') return res.status(400).json({ message: error.message });
  if (error.code === 'NOT_BOOKABLE') return res.status(422).json({ message: error.message });
  if (error.code === 'DAILY_CAPACITY') return res.status(409).json({ message: error.message });
  if (error.code === 'BOOKING_CONFLICT') return res.status(409).json({ message: error.message });
  if (error.code === 'NOT_FOUND') return res.status(404).json({ message: error.message });
  if (error.code === 'ALREADY_REVIEWED') return res.status(409).json({ message: error.message });
  if (error.code === 'LIFT_REQUIRED') return res.status(409).json({ message: error.message });
  if (error.code === 'NOT_ASSIGNABLE') return res.status(409).json({ message: error.message });
  if (error.code === 'LIFT_UNAVAILABLE' || error.code === 'LIFT_HAS_APPOINTMENTS') return res.status(409).json({ message: error.message });
  return next(error);
}

appointmentsRouter.get('/services', requireRole('cliente'), async (req, res, next) => {
  try {
    const services = await getServices();
    const workshop = await getWorkshop();
    return res.json({ services: services.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      price: Number(service.estimatedPrice) + Number(workshop.quoteBase || 0),
      currency: workshop.currency || 'ARS',
      durationMinutes: service.durationMinutes,
      durationIsProvisional: Boolean(service.durationIsProvisional),
      available: Boolean(service.enabled && service.suppliesAvailable)
    })) });
  } catch (error) {
    return next(error);
  }
});

appointmentsRouter.get('/availability', requireRole('cliente'), async (req, res, next) => {
  try {
    const availability = await getAvailability(req.query.serviceId, req.query.date);
    return res.json(availability);
  } catch (error) {
    return sendAppointmentError(error, res, next);
  }
});

appointmentsRouter.post('/', requireRole('cliente'), requireJson, async (req, res, next) => {
  try {
    const appointment = await createAppointment(req.body || {}, req.user.id);
    return res.status(201).json({
      message: 'Tu solicitud de turno quedó registrada.',
      appointment: {
        id: appointment.id,
        receiptNumber: appointment.id.slice(0, 8).toUpperCase(),
        serviceName: appointment.serviceName,
        vehicle: appointment.vehicle,
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        durationMinutes: appointment.durationMinutes,
        liftName: appointment.liftName,
        estimatedTotal: appointment.estimatedTotal,
        currency: appointment.currency,
        quoteStatus: appointment.quoteStatus,
        status: appointment.status
      }
    });
  } catch (error) {
    return sendAppointmentError(error, res, next);
  }
});

appointmentsRouter.get('/mine', requireRole('cliente'), async (req, res, next) => {
  try {
    const appointments = await listAppointmentsForUser(req.user.id);
    return res.json({ appointments });
  } catch (error) {
    return next(error);
  }
});

appointmentsRouter.get('/management', requireRole('jefe-taller'), async (req, res, next) => {
  try {
    const [appointments, lifts, mechanics] = await Promise.all([
      listAppointmentsForManagement(), getManagementLiftStatuses(), listMechanicsForManagement()
    ]);
    return res.json({ appointments, lifts, mechanics });
  } catch (error) {
    return next(error);
  }
});

appointmentsRouter.patch('/management/mechanics/:mechanicId/lift', requireRole('jefe-taller'), requireJson, async (req, res, next) => {
  try {
    const mechanic = await assignMechanicToLift(req.params.mechanicId, req.body?.liftId);
    return res.json({
      message: 'Asignación del mecánico actualizada.',
      mechanic: { id: mechanic.id, name: mechanic.nombre, liftId: mechanic.liftId }
    });
  } catch (error) {
    return sendAppointmentError(error, res, next);
  }
});

appointmentsRouter.get('/mechanic', requireRole('mecanico'), async (req, res, next) => {
  try {
    const agenda = await listAppointmentsForMechanic(req.user.id);
    return res.json(agenda);
  } catch (error) {
    return sendAppointmentError(error, res, next);
  }
});

appointmentsRouter.patch('/management/lifts/:liftId', requireRole('jefe-taller'), requireJson, async (req, res, next) => {
  try {
    const lift = await updateLiftEnabled(req.params.liftId, req.body?.enabled);
    return res.json({ message: `Elevador ${lift.enabled ? 'habilitado' : 'deshabilitado'}.`, lift });
  } catch (error) {
    return sendAppointmentError(error, res, next);
  }
});

appointmentsRouter.patch('/management/:appointmentId/lift', requireRole('jefe-taller'), requireJson, async (req, res, next) => {
  try {
    const appointment = await updateAppointmentLift(req.params.appointmentId, req.body?.liftId);
    return res.json({ message: 'Elevador asignado.', appointment: { id: appointment.id, liftId: appointment.liftId, liftName: appointment.liftName } });
  } catch (error) {
    return sendAppointmentError(error, res, next);
  }
});

appointmentsRouter.patch('/management/:appointmentId', requireRole('jefe-taller'), requireJson, async (req, res, next) => {
  try {
    const appointment = await updateAppointmentStatus(req.params.appointmentId, req.body?.status, req.user.id);
    return res.json({
      message: ({ confirmado: 'Turno aprobado.', rechazado: 'Solicitud rechazada.', finalizado: 'Trabajo marcado como finalizado.' })[appointment.status],
      appointment: { id: appointment.id, status: appointment.status, reviewedAt: appointment.reviewedAt || null, completedAt: appointment.completedAt || null }
    });
  } catch (error) {
    return sendAppointmentError(error, res, next);
  }
});

module.exports = { appointmentsRouter };
