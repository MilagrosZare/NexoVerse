const { all, one, run } = require('./query');

/*
"r" es un alias para recursos. 
"t" es un alias para "tipos_recursos".
JOIN relaciona ambas tablas utilizando tipo_recurso_id
"r.*" devuelve todas las columnas del recurso.
*/
exports.listAvailable = () => all(
  `SELECT r.*, t.nombre AS plataforma
    FROM recursos r JOIN tipos_recursos t ON t.id = r.tipo_recurso_id
    WHERE r.estado = 'DISPONIBLE'
    ORDER BY t.nombre, r.modalidad_recurso, r.nombre`
);

/* Limita los resultados a una plataforma. El ? se reemplaza con el valor de platformId.*/
exports.listAvailableByPlatform = platformId => all(
  `SELECT r.*, t.nombre AS plataforma
    FROM recursos r JOIN tipos_recursos t ON t.id = r.tipo_recurso_id
    WHERE r.estado = 'DISPONIBLE' AND r.tipo_recurso_id = ?
    ORDER BY r.modalidad_recurso, r.nombre`,
  [platformId]
);

/* Busca un recurso específico, comprueba que su ID sea el solicitado, pertenezca a la plataforma elegida y que esté disponible. Utiliza "one" porque busca un ÚNICO RECURSO. */
exports.findAvailable = (resourceId, platformId) => one(
  `SELECT r.*, t.nombre AS plataforma
    FROM recursos r JOIN tipos_recursos t ON t.id = r.tipo_recurso_id
    WHERE r.id = ? AND t.id = ? AND r.estado = 'DISPONIBLE'`,
  [resourceId, platformId]
);
// Lista todos los recursos para el panel, también los que están en mantenimiento.
exports.listAll = () => all(
  `SELECT r.*, t.nombre AS plataforma FROM recursos r
    JOIN tipos_recursos t ON t.id = r.tipo_recurso_id
    ORDER BY t.nombre, r.modalidad_recurso, r.nombre`
);

// Busca un equipo disponible que el administrador seleccionó para una reserva.
exports.findAvailableById = id => one(
  "SELECT * FROM recursos WHERE id = ? AND estado = 'DISPONIBLE'", [id]
);

// Agrega un recurso con su plataforma, nombre, tipo, capacidad y descripción.
exports.create = data => run(
  `INSERT INTO recursos(tipo_recurso_id, nombre, modalidad_recurso, capacidad_maxima, descripcion)
    VALUES (?, ?, ?, ?, ?)`,
  [data.platformId, data.nombre, data.modalidad, data.capacidad, data.descripcion]
);

// Evita eliminar un recurso que aparezca en el historial de reservas.
exports.delete = id => run(
  `DELETE FROM recursos WHERE id = ?
    AND NOT EXISTS (SELECT 1 FROM reservas WHERE recurso_id = ?)`, [id, id]
);