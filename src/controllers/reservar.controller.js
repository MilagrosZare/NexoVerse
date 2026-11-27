const Reservation = require('../models/Reservation');
const Resource = require('../models/Resource');

// Obtiene la fecha local con formato AAAA-MM-DD.
const today = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); //padStart se utiliza para completar el número, ej: de 9 a 09
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

const validDate = date => {
  // Comprueba formato, que la fecha exista en el calendario y que no sea anterior a hoy.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false; //expresión regular: comprueba que la fecha tenga formato año-mes-dia
  const parsed = new Date(`${date}T12:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date && date >= today();
};

// Si es hoy, permite elegir únicamente horarios que todavía no empezaron.
const isFutureSlot = (date, start) => {
    if (date !== today()) return true;

    const now = new Date();
    const currentTime =
        `${String(now.getHours()).padStart(2, '0')}:` +
        `${String(now.getMinutes()).padStart(2, '0')}`;

    return start > currentTime;
};
const getSlots = (duration, busy, date) => {
  // Recorre el horario del local en bloques de una hora y devuelve solo los que caben en la duración elegida.
  const slots = [];
  for (let hour = 10; hour + duration <= 21; hour += 1) {
    const start = `${String(hour).padStart(2, '0')}:00`;
    const end = `${String(hour + duration).padStart(2, '0')}:00`;
    // Dos turnos se superponen si uno empieza antes del otro y termina después de su inicio.
    const overlaps = busy.some(row => row.hora_inicio < end && row.hora_fin > start);
    if (isFutureSlot(date, start) && !overlaps) slots.push({ start, end });
  }
  return slots;
};
const formValues = body => ({
  // Conserva lo enviado por el cliente para volver a mostrarlo si una validación falla.
  plataforma: String(body.plataforma || ''),
  modalidad: String(body.modalidad || ''),
  recurso: String(body.recurso || ''),
  personas: String(body.personas || ''),
  fecha: String(body.fecha || ''),
  inicio: String(body.inicio || ''),
  duracion: String(body.duracion || '1')
});

const renderForm = async (req, res, values, error = '', status = 200) => {
  // Esta función evita repetir la carga de recursos cada vez que hay que mostrar el formulario.
  const recursos = await Resource.listAvailable();
  res.status(status).render('reservar/nueva_reserva', { recursos, valores: values, error });
};

// GET /reservar: prepara el formulario con recursos disponibles y la fecha de hoy como mínimo.
exports.new = async (req, res, next) => {
  try {
    await renderForm(req, res, { fecha: today(), duracion: '1' });
  } catch (error) {
    next(error);
  }
};

// GET /reservar/disponibilidad: responde JSON para que el navegador actualice la lista de horarios.
exports.availability = async (req, res, next) => {
  try {
    const date = String(req.query.fecha || '');
    const duration = Number(req.query.duracion);
    const people = Number(req.query.personas);
    const mode = String(req.query.modalidad || '');
    const platformId = Number(req.query.plataforma);
    //Si es modalidad "SOLO", directamente bloquea la capacidad de elección.
    if (mode === 'SOLO' && people !== 1) {
      return res.status(400).json({ error: 'En modalidad SOLO se reserva para una sola persona.' });
    }
    if (people > 10) {
      return res.status(400).json({ error: 'El máximo es de 10 personas.' });
    }
    if (!validDate(date) || ![1, 2, 3].includes(duration) || !Number.isInteger(people) ||
          people < 1 || (mode === 'SOLO' && people !== 1) || !['SOLO', 'TEAM'].includes(mode) || !Number.isInteger(platformId) || platformId < 1) {
      return res.status(400).json({ error: 'Completá modalidad, plataforma, fecha, duración y cantidad de personas.' });
    }

    // Primero limita la búsqueda a la plataforma elegida, así no mezcla PC con consolas.
    const recursos = await Resource.listAvailableByPlatform(platformId);
    const pcs = recursos.filter(resource => resource.plataforma === 'PC' && resource.modalidad_recurso === 'INDIVIDUAL');
    // En modalidad TEAM con PC se busca un horario con suficientes computadoras libres para todos.
    if (pcs.length && mode === 'TEAM') {
      if (people < 2) return res.json({ recursos: [] });
      const busy = await Reservation.listBusy(date, pcs.map(pc => pc.id));
      const groupSlots = [];
      for (let hour = 10; hour + duration <= 21; hour += 1) {
        const start = `${String(hour).padStart(2, '0')}:00`;
        const end = `${String(hour + duration).padStart(2, '0')}:00`;
        //Cuenta cuántas PCs quedan libres
        const freeCount = pcs.filter(pc => !busy.some(row => row.recurso_id === pc.id && row.hora_inicio < end && row.hora_fin > start)).length;
        if (freeCount >= people && isFutureSlot(date, start)) groupSlots.push({ start, end });
      }
      return res.json({ recursos: groupSlots.length ? [{
        id: pcs[0].id,
        nombre: `Grupo · ${people} PC Gamer`,
        modalidad_recurso: 'GRUPO',
        horarios: groupSlots
      }] : [] });
    }

    // Descarta recursos que no admiten esa cantidad de personas.
    const eligible = recursos.filter(resource => {
      if (resource.plataforma === 'PC' && resource.modalidad_recurso === 'INDIVIDUAL') return people === 1;
      return people <= resource.capacidad_maxima;
    });
    // Reutiliza la misma lista de ocupados para calcular los horarios de cada recurso.
    const busy = await Reservation.listBusy(date, eligible.map(resource => resource.id));
    const result = eligible.map(resource => ({
      id: resource.id,
      nombre: resource.nombre,
      modalidad_recurso: resource.modalidad_recurso,
      horarios: getSlots(duration, busy.filter(row => row.recurso_id === resource.id), date)
    }));
    res.json({ recursos: result });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  // Los valores de los formularios llegan como texto; Number() los convierte antes de compararlos.
  const values = formValues(req.body);
  try {
    const platformId = Number(values.plataforma);
    const people = Number(values.personas);
    const duration = Number(values.duracion);
    const start = values.inicio;
    if (values.modalidad === 'SOLO' && people !== 1) {
      return renderForm(req, res, values, 'En modalidad SOLO se reserva para una sola persona.', 400);
    }
    if (people > 10) {
      return renderForm(req, res, values, 'El máximo es de 10 personas.', 400);
    }
    if (!['SOLO', 'TEAM'].includes(values.modalidad) || !Number.isInteger(platformId) || platformId < 1 ||
    !Number.isInteger(people) || people < 1 || ![1, 2, 3].includes(duration) ||
        !validDate(values.fecha) || !/^\d{2}:00$/.test(start)) { //expresión regular: comprueba que la hora tenga HH:00
      return renderForm(req, res, values, 'Revisá los datos de la reserva.', 400);
    }
    const startHour = Number(start.slice(0, 2));
    const endHour = startHour + duration;
    if (startHour < 10 || endHour > 21) {
      return renderForm(req, res, values, 'El horario debe estar entre las 10:00 y las 21:00.', 400);
    }
    if (!isFutureSlot(values.fecha, start)) {
      return renderForm(req, res, values, 'Elegí un horario que todavía no haya comenzado.', 400);
    }

    // El modelo vuelve a comprobar la disponibilidad dentro de una transacción antes de guardar.
    await Reservation.create({
      userId: req.user.id,
      resourceId: Number(values.recurso),
      platformId,
      modalidad: values.modalidad,
      personas: people,
      fecha: values.fecha,
      horaInicio: start,
      horaFin: `${String(endHour).padStart(2, '0')}:00`,
      duracion: duration
    });
    res.redirect('/reservas?mensaje=Reserva confirmada correctamente');
  } catch (error) {
    if (error.message.startsWith('SQLITE')) return next(error);
    try {
      await renderForm(req, res, values, error.message, 400);
    } catch (renderError) {
      next(renderError);
    }
  }
};
