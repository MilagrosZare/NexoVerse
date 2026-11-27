const Reservation = require('../models/Reservation');

// Muestra únicamente las reservas asociadas con el usuario que inició sesión.
exports.index = async (req, res, next) => {
  try {
    const reservas = await Reservation.listByUser(req.user.id);
    res.render('reservas/index', { reservas });
  } catch (error) {
    next(error);
  }
};

// Pide al modelo cancelar la reserva y vuelve al historial con un mensaje.
exports.cancel = async (req, res, next) => {
  try {
    const result = await Reservation.cancelForUser(Number(req.params.id), req.user.id);
    const message = result.changes ? 'Reserva cancelada' : 'No se encontró una reserva activa propia';
    res.redirect(`/reservas?mensaje=${encodeURIComponent(message)}`);
  } catch (error) {
    next(error);
  }
};
