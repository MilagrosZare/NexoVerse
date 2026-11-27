const crypto = require('crypto'); //Genera códigos aleatorios que identifican las reservas grupales.
const { all, one, run, transaction } = require('./query');

// Busca las reservas de una persona usando el userID
// GROUP BY COALESCE: Agrupa las reservas que tienen un mismo código.
// GROUP_CONCAT junta varios valores de texto en uno solo.

exports.listByUser = userId => all(
  `SELECT b.*, GROUP_CONCAT(r.nombre, ', ') AS recurso, t.nombre AS plataforma
    FROM reservas b
    JOIN recursos r ON r.id = b.recurso_id
    JOIN tipos_recursos t ON t.id = r.tipo_recurso_id
    WHERE b.usuario_id = ?
    GROUP BY COALESCE(b.codigo_grupo, 'reserva-' || b.id)
    ORDER BY b.fecha DESC, b.hora_inicio DESC`,
  [userId]
);

// La página de inicio muestra solo las reservas más recientes del cliente.
exports.listRecentByUser = (userId, limit = 5) => all(
  `SELECT b.*, GROUP_CONCAT(r.nombre, ', ') AS recurso, t.nombre AS plataforma
    FROM reservas b
    JOIN recursos r ON r.id = b.recurso_id
    JOIN tipos_recursos t ON t.id = r.tipo_recurso_id
    WHERE b.usuario_id = ?
    GROUP BY COALESCE(b.codigo_grupo, 'reserva-' || b.id)
    ORDER BY b.fecha DESC, b.hora_inicio DESC
    LIMIT ?`,
  [userId, limit]
); //Limit establece cuántas reservas queremos mostrar.

// Detecta si la elección del cliente está ocupada.
//date --> fecha que queremos consultar.
//resourceIds --> identificadores de recursos, ej PC-01, PC-02, etc
exports.listBusy = (date, resourceIds) => {
  if (!resourceIds.length) return Promise.resolve([]);
  const placeholders = resourceIds.map(() => '?').join(', ');
  return all(
    `SELECT recurso_id, hora_inicio, hora_fin FROM reservas
      WHERE fecha = ? AND estado = 'CONFIRMADA' AND recurso_id IN (${placeholders})`,
    [date, ...resourceIds]
  );
};


// CREACIÓN DE UNA RESERVA
exports.create = booking => transaction(async tx => {
    // La consulta vuelve a buscar el recurso dentro de la transacción, por si cambió desde que se mostró el formulario.
    // Reglas generales: SOLO es exactamente una persona y TEAM admite hasta diez.
    if (booking.personas > 10) throw new Error('El máximo es de 10 personas.');
    if (booking.modalidad === 'SOLO' && booking.personas !== 1) {
      throw new Error('En modalidad SOLO se reserva para una sola persona.');
    }
    const resources = await tx.all(
      `SELECT r.*, t.nombre AS plataforma
      FROM recursos r JOIN tipos_recursos t ON t.id = r.tipo_recurso_id
      WHERE r.id = ? AND t.id = ? AND r.estado = 'DISPONIBLE'`,
      [booking.resourceId, booking.platformId]
    );
    if (!resources.length) throw new Error('El recurso elegido ya no está disponible.');

    // Una consulta SQL devuelve una lista; el formulario solo permite elegir un recurso inicial.
    const selected = resources[0];
    let chosen = [selected];
    if (selected.modalidad_recurso === 'INDIVIDUAL' && selected.plataforma === 'PC' && booking.modalidad === 'TEAM') {
      if (booking.personas < 2) throw new Error('La modalidad TEAM requiere al menos dos personas.');
      const pcs = await tx.all(
        `SELECT id, capacidad_maxima FROM recursos
          WHERE tipo_recurso_id = ? AND modalidad_recurso = 'INDIVIDUAL' AND estado = 'DISPONIBLE'
          ORDER BY nombre`,
        [booking.platformId]
      ); //Recopila información de computadoras "ocupadas"
      const busy = await tx.all(
        `SELECT recurso_id, hora_inicio, hora_fin FROM reservas
          WHERE fecha = ? AND estado = 'CONFIRMADA'
            AND recurso_id IN (${pcs.map(() => '?').join(', ')})`,
        [booking.fecha, ...pcs.map(pc => pc.id)]
      );
      // Set guarda los IDs ocupados para poder descartarlos rápidamente de la lista de PC.
      const busyIds = new Set(busy
        .filter(row => row.hora_inicio < booking.horaFin && row.hora_fin > booking.horaInicio)
        .map(row => row.recurso_id));
      // En PC grupal necesitamos una computadora libre por integrante.
      chosen = pcs.filter(pc => !busyIds.has(pc.id)).slice(0, booking.personas);
      if (chosen.length < booking.personas) {
        throw new Error('No hay suficientes PC libres para todo el grupo en ese horario.');
      }
    } else if (selected.capacidad_maxima < booking.personas) {
      throw new Error('La cantidad de personas supera la capacidad del recurso.');
    }

    // Revisión final para consolas, salas y también para las PC elegidas del grupo.
    const busy = await tx.all(
      `SELECT recurso_id, hora_inicio, hora_fin FROM reservas
        WHERE fecha = ? AND estado = 'CONFIRMADA'
          AND recurso_id IN (${chosen.map(() => '?').join(', ')})`,
      [booking.fecha, ...chosen.map(resource => resource.id)]
    );
    //¿La reserva existente empieza antes de que termine el horario que quiere el cliente?
    //¿La reserva existente termina después de que comienza el horario que quiere el cliente?
    if (busy.some(row => row.hora_inicio < booking.horaFin && row.hora_fin > booking.horaInicio)) {
      throw new Error('Ese horario acaba de ocuparse. Elegí otro horario.');
    }

    // El código común permite identificar y cancelar todas las PC del mismo grupo juntas.
    const groupCode = chosen.length > 1 ? crypto.randomUUID() : null;
    const reservationIds = [];
    // Una reserva individual inserta una fila; un grupo PC inserta una por computadora.
    for (const resource of chosen) {
      const result = await tx.run(
        `INSERT INTO reservas(
            usuario_id, recurso_id, modalidad_juego, cantidad_personas,
            fecha, hora_inicio, duracion, hora_fin, codigo_grupo, estado
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMADA')`,
        [booking.userId, resource.id, booking.modalidad, booking.personas,
          booking.fecha, booking.horaInicio, booking.duracion, booking.horaFin, groupCode]
      );
      reservationIds.push(result.id);
    }
    return { ids: reservationIds, groupCode };
});

// La cancelación cambia el estado en vez de borrar filas, así se conserva el historial.
// Si la reserva es grupal, la misma condición actualiza todas sus filas vinculadas.
exports.cancelForUser = (reservationId, userId) => run(
  `UPDATE reservas SET estado = 'CANCELADA'
    WHERE usuario_id = ? AND estado = 'CONFIRMADA'
      AND (id = ? OR codigo_grupo = (
        SELECT codigo_grupo FROM reservas WHERE id = ? AND usuario_id = ?
      ))`,
  [userId, reservationId, reservationId, userId]
);
// Lista reservas para el administrador, incluyendo datos del cliente y del recurso.
exports.listAll = () => all(
  `SELECT b.*, u.nombre || ' ' || u.apellido AS cliente, u.email,
          GROUP_CONCAT(r.nombre, ', ') AS recurso, t.nombre AS plataforma
    FROM reservas b
    JOIN usuarios u ON u.id = b.usuario_id
    JOIN recursos r ON r.id = b.recurso_id
    JOIN tipos_recursos t ON t.id = r.tipo_recurso_id
    GROUP BY COALESCE(b.codigo_grupo, 'reserva-' || b.id)
    ORDER BY b.fecha DESC, b.hora_inicio DESC`
);

// Busca una reserva confirmada para editar o cancelar desde el panel.
exports.findForAdmin = id => one(
  `SELECT b.*, u.nombre || ' ' || u.apellido AS cliente, r.nombre AS nombre_recurso
    FROM reservas b
    JOIN usuarios u ON u.id = b.usuario_id
    JOIN recursos r ON r.id = b.recurso_id
    WHERE b.id = ? AND b.estado = 'CONFIRMADA'`,
    [id]
);

// Cambia la fecha y horario solo si los recursos están libres en ese momento.
exports.updateSchedule = (id, schedule) => transaction(async tx => {
  // Busca la reserva activa dentro de la transacción.
  const booking = await tx.one('SELECT * FROM reservas WHERE id = ? AND estado = \'CONFIRMADA\'', [id]);
  if (!booking) throw new Error('No se encontró una reserva confirmada.');

  // Si el turno usa varias PC, recoge todas las filas para moverlas juntas.
  const rows = booking.codigo_grupo
    ? await tx.all('SELECT id, recurso_id FROM reservas WHERE codigo_grupo = ? AND estado = \'CONFIRMADA\'', [booking.codigo_grupo])
    : [booking];
  const reservationIds = rows.map(row => row.id);
  const resourceIds = rows.map(row => row.recurso_id);
  const placeholders = resourceIds.map(() => '?').join(', ');

  // Busca otros turnos confirmados de esos recursos en la fecha nueva.
  const busy = await tx.all(
    `SELECT id, hora_inicio, hora_fin FROM reservas
      WHERE fecha = ? AND estado = 'CONFIRMADA' AND recurso_id IN (${placeholders})`,
    [schedule.fecha, ...resourceIds]
  );
  // Detecta si otra reserva se cruza con el horario nuevo.
  const conflict = busy.some(item => !reservationIds.includes(item.id) &&
    item.hora_inicio < schedule.horaFin && item.hora_fin > schedule.horaInicio);
  if (conflict) throw new Error('Ese horario ya está ocupado. Elegí otro.');

  // Modifica todas las filas del grupo o la fila individual.
  const condition = booking.codigo_grupo ? 'codigo_grupo = ?' : 'id = ?';
  const value = booking.codigo_grupo || id;
  await tx.run(
    `UPDATE reservas SET fecha = ?, hora_inicio = ?, hora_fin = ?, duracion = ?
      WHERE ${condition} AND estado = 'CONFIRMADA'`,
    [schedule.fecha, schedule.horaInicio, schedule.horaFin, schedule.duracion, value]
  );
});

// Cancela la reserva y las filas vinculadas si el turno es de un grupo.
exports.cancelForAdmin = id => run(
  `UPDATE reservas SET estado = 'CANCELADA'
    WHERE estado = 'CONFIRMADA'
      AND (id = ? OR codigo_grupo = (SELECT codigo_grupo FROM reservas WHERE id = ?))`,
      [id, id]
);