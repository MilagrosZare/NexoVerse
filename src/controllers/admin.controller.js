const Game = require('../models/Game');
const Resource = require('../models/Resource');
const Reservation = require('../models/Reservation');
const User = require('../models/User');

const redirectWithMessage = (res, url, message) =>
res.redirect(`${url}?mensaje=${encodeURIComponent(message)}`);

// Muestra los accesos principales del panel.
exports.index = (req, res) => res.render('admin/index');

// -------------------- JUEGOS --------------------

const readGameForm = body => {
const rawPlatforms = Array.isArray(body.plataformas)
    ? body.plataformas
    : body.plataformas
    ? [body.plataformas]
    : [];
const platformIds = [];

for (const value of rawPlatforms) {
    const id = Number(value);
    if (Number.isInteger(id) && !platformIds.includes(id)) platformIds.push(id);
}

return {
    nombre: String(body.nombre || '').trim(),
    descripcion: String(body.descripcion || '').trim(),
    genero: String(body.genero || '').trim(),
    imagen: String(body.imagen || '').trim(),
    platformIds
    };
};

const renderGameForm = async (res, game, selectedPlatforms, error = '', status = 200) => {
const platforms = await Game.listPlatforms();
return res.status(status).render('admin/juegos/form', {
    juego: game,
    plataformas: platforms,
    plataformasSeleccionadas: selectedPlatforms,
    error
});
};

exports.games = async (req, res, next) => {
try {
    const juegos = await Game.list();
    res.render('admin/juegos/index', { juegos });
} catch (error) {
    next(error);
}
};

exports.newGameForm = (req, res) => renderGameForm(res, {}, [], '');

exports.createGame = async (req, res, next) => {
const game = readGameForm(req.body);
if (!game.nombre || game.nombre.length > 100) {
    return renderGameForm(res, game, game.platformIds, 'Escribí un nombre de hasta 100 caracteres.', 400);
}

try {
    await Game.create(game);
    redirectWithMessage(res, '/admin/juegos', 'Juego agregado al catálogo.');
} catch (error) {
    next(error);
}
};

exports.editGameForm = async (req, res, next) => {
try {
    const game = await Game.findById(Number(req.params.id));
    if (!game) return redirectWithMessage(res, '/admin/juegos', 'No se encontró ese juego.');

    const selectedPlatforms = await Game.listPlatformIds(game.id);
    return renderGameForm(
    res,
    game,
    selectedPlatforms.map(platform => platform.tipo_recurso_id),
    ''
    );
} catch (error) {
    next(error);
}
};

exports.updateGame = async (req, res, next) => {
const id = Number(req.params.id);
const game = readGameForm(req.body);
if (!game.nombre || game.nombre.length > 100) {
    return renderGameForm(res, { ...game, id }, game.platformIds, 'Escribí un nombre de hasta 100 caracteres.', 400);
}

try {
    await Game.update(id, game);
    redirectWithMessage(res, '/admin/juegos', 'Cambios del juego guardados.');
} catch (error) {
    next(error);
}
};

exports.deleteGame = async (req, res, next) => {
try {
    const result = await Game.delete(Number(req.params.id));
    const message = result.changes ? 'Juego eliminado del catálogo.' : 'No se encontró ese juego.';
    redirectWithMessage(res, '/admin/juegos', message);
} catch (error) {
    next(error);
}
};

// -------------------- RECURSOS --------------------

exports.resources = async (req, res, next) => {
try {
    const recursos = await Resource.listAll();
    const plataformas = await Game.listPlatforms();
    res.render('admin/recursos/index', { recursos, plataformas, error: '' });
} catch (error) {
    next(error);
}
};

exports.createResource = async (req, res, next) => {
const resource = {
    platformId: Number(req.body.plataforma),
    nombre: String(req.body.nombre || '').trim(),
    modalidad: String(req.body.modalidad || ''),
    capacidad: Number(req.body.capacidad),
    descripcion: String(req.body.descripcion || '').trim()
};

const platforms = await Game.listPlatforms();
const validPlatform = platforms.some(platform => platform.id === resource.platformId);
const validMode = ['INDIVIDUAL', 'SALA'].includes(resource.modalidad);
const selectedPlatform = platforms.find(platform => platform.id === resource.platformId);
const validPcCapacity = !(selectedPlatform && selectedPlatform.nombre === 'PC' &&
    resource.modalidad === 'INDIVIDUAL' && resource.capacidad !== 1);
if (!validPlatform || !resource.nombre || resource.nombre.length > 100 || !validMode ||
    !validPcCapacity || !Number.isInteger(resource.capacidad) || resource.capacidad < 1 || resource.capacidad > 32) {
    const recursos = await Resource.listAll();
    return res.status(400).render('admin/recursos/index', {
    recursos,
    plataformas: platforms,
    error: 'Revisá plataforma, nombre, modalidad y capacidad.'
    });
}

try {
    await Resource.create(resource);
    redirectWithMessage(res, '/admin/recursos', 'Recurso agregado.');
} catch (error) {
    if (String(error.message).includes('UNIQUE')) {
    const recursos = await Resource.listAll();
    return res.status(409).render('admin/recursos/index', {
        recursos,
        plataformas: platforms,
        error: 'Ya existe un equipo o sala con ese nombre.'
    });
}
    next(error);
}
};

exports.deleteResource = async (req, res, next) => {
try {
    const result = await Resource.delete(Number(req.params.id));
    const message = result.changes
    ? 'Recurso eliminado.'
    : 'No se puede eliminar: no existe o ya tiene reservas en su historial.';
    redirectWithMessage(res, '/admin/recursos', message);
} catch (error) {
    next(error);
}
};

// -------------------- RESERVAS --------------------

const today = () => {
const now = new Date();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
return `${now.getFullYear()}-${month}-${day}`;
};

const validDate = date => {
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
const parsed = new Date(`${date}T12:00:00`);
return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date && date >= today();
};

const readBookingForm = body => ({
userId: Number(body.cliente),
resourceId: Number(body.recurso),
modalidad: String(body.modalidad || ''),
personas: Number(body.personas),
fecha: String(body.fecha || ''),
horaInicio: String(body.inicio || ''),
duracion: Number(body.duracion)
});

const validateBooking = booking => {
if (!Number.isInteger(booking.userId) || booking.userId < 1) return 'Elegí un cliente.';
if (!Number.isInteger(booking.resourceId) || booking.resourceId < 1) return 'Elegí un equipo o sala.';
if (!['SOLO', 'TEAM'].includes(booking.modalidad)) return 'Elegí una modalidad.';
if (!Number.isInteger(booking.personas) || booking.personas < 1 || booking.personas > 10) {
    return 'La cantidad debe ser de 1 a 10 personas.';
}
if (booking.modalidad === 'SOLO' && booking.personas !== 1) return 'SOLO es para una persona.';
if (booking.modalidad === 'TEAM' && booking.personas < 2) return 'TEAM requiere al menos dos personas.';
if (!validDate(booking.fecha)) return 'Elegí una fecha válida, desde hoy en adelante.';
if (![1, 2, 3].includes(booking.duracion) || !/^\d{2}:00$/.test(booking.horaInicio)) {
    return 'Elegí un horario y una duración válidos.';
}

const hour = Number(booking.horaInicio.slice(0, 2));
if (hour < 10 || hour + booking.duracion > 21) return 'El horario debe estar entre las 10:00 y las 21:00.';
return '';
};

const renderBookingForm = async (res, values, error = '', status = 200) => {
const clientes = await User.listClients();
const recursos = await Resource.listAvailable();
return res.status(status).render('admin/reservas/nueva', { clientes, recursos, valores: values, error });
};

exports.reservations = async (req, res, next) => {
try {
    const reservas = await Reservation.listAll();
    res.render('admin/reservas/index', { reservas });
} catch (error) {
    next(error);
}
};

exports.newReservationForm = (req, res) => renderBookingForm(res, {
fecha: today(), modalidad: 'SOLO', personas: '1', duracion: '1'
});

exports.createReservation = async (req, res, next) => {
const booking = readBookingForm(req.body);
const validationError = validateBooking(booking);
if (validationError) return renderBookingForm(res, req.body, validationError, 400);

try {
    const client = await User.findClientById(booking.userId);
    if (!client) return renderBookingForm(res, req.body, 'La cuenta elegida no es un cliente.', 400);

    const resource = await Resource.findAvailableById(booking.resourceId);
    if (!resource) return renderBookingForm(res, req.body, 'El recurso ya no está disponible.', 400);

    const endHour = Number(booking.horaInicio.slice(0, 2)) + booking.duracion;
    booking.horaFin = `${String(endHour).padStart(2, '0')}:00`;
    booking.platformId = resource.tipo_recurso_id;

    await Reservation.create(booking);
    redirectWithMessage(res, '/admin/reservas', 'Reserva creada para el cliente.');
} catch (error) {
    if (String(error.message).includes('SQLITE')) return next(error);
    return renderBookingForm(res, req.body, error.message, 400);
}
};

exports.editReservationForm = async (req, res, next) => {
try {
    const reserva = await Reservation.findForAdmin(Number(req.params.id));
    if (!reserva || reserva.estado !== 'CONFIRMADA') {
    return redirectWithMessage(res, '/admin/reservas', 'No se encontró una reserva activa para editar.');
    }

    res.render('admin/reservas/editar', { reserva, error: '', minFecha: today() });
} catch (error) {
    next(error);
}
};

exports.updateReservationSchedule = async (req, res, next) => {
const id = Number(req.params.id);
const reserva = await Reservation.findForAdmin(id);
if (!reserva || reserva.estado !== 'CONFIRMADA') {
    return redirectWithMessage(res, '/admin/reservas', 'No se encontró una reserva activa para editar.');
}

const fecha = String(req.body.fecha || '');
const horaInicio = String(req.body.inicio || '');
const duracion = Number(req.body.duracion);
const hour = Number(horaInicio.slice(0, 2));
const validationError = !validDate(fecha)
    ? 'Elegí una fecha válida, desde hoy en adelante.'
    : ![1, 2, 3].includes(duracion) || !/^\d{2}:00$/.test(horaInicio) || hour < 10 || hour + duracion > 21
    ? 'Elegí un horario válido entre las 10:00 y las 21:00.'
    : '';

if (validationError) {
    return res.status(400).render('admin/reservas/editar', { reserva, error: validationError, minFecha: today() });
}

const horaFin = `${String(hour + duracion).padStart(2, '0')}:00`;
try {
    await Reservation.updateSchedule(id, { fecha, horaInicio, horaFin, duracion });
    redirectWithMessage(res, '/admin/reservas', 'Horario de la reserva actualizado.');
} catch (error) {
    if (String(error.message).includes('SQLITE')) return next(error);
    return res.status(400).render('admin/reservas/editar', { reserva, error: error.message, minFecha: today() });
}
};

exports.cancelReservation = async (req, res, next) => {
try {
    const result = await Reservation.cancelForAdmin(Number(req.params.id));
    const message = result.changes ? 'Reserva cancelada.' : 'No se encontró una reserva activa.';
    redirectWithMessage(res, '/admin/reservas', message);
} catch (error) {
    next(error);
}
};