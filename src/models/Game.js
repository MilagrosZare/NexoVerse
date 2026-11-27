// Importa transaction porque create() y update() guardan varios cambios juntos.
const { all, one, run, transaction } = require('./query');

// Las plataformas se usan para llenar el selector de filtros del catálogo y del formulario de reserva.
exports.listPlatforms = () => all(
  'SELECT id, nombre FROM tipos_recursos ORDER BY nombre'
);

// Busca juegos y junta en una sola columna los nombres de las plataformas donde están disponibles.
// platformId vacío significa "todas"; limit permite mostrar solo algunos juegos en la página de inicio.
exports.list = (platformId = null, limit = null) => {
  const limitSql = Number.isInteger(limit) ? 'LIMIT ?' : '';
  const params = [platformId, platformId];
  if (Number.isInteger(limit)) params.push(limit);
  return all(
    `SELECT j.*, GROUP_CONCAT(t.nombre, ', ') AS plataformas
      FROM juegos j
      LEFT JOIN juegos_plataformas jp ON jp.juego_id = j.id
      LEFT JOIN tipos_recursos t ON t.id = jp.tipo_recurso_id
      WHERE (? IS NULL OR EXISTS (
        SELECT 1 FROM juegos_plataformas filtro
        WHERE filtro.juego_id = j.id AND filtro.tipo_recurso_id = ?
      ))
      GROUP BY j.id
      ORDER BY j.nombre ${limitSql}`,
    params
  );
};
// Busca un juego por su ID para mostrar los datos en el formulario de edición.
exports.findById = id => one('SELECT * FROM juegos WHERE id = ?', [id]);

// Devuelve los IDs de las plataformas asociadas a un juego.
exports.listPlatformIds = id => all(
  'SELECT tipo_recurso_id FROM juegos_plataformas WHERE juego_id = ?', [id]
);

// Agrega un juego y sus plataformas seleccionadas dentro de una transacción.
exports.create = data => transaction(async tx => {
  // Primero se agrega la información principal del juego.
  const result = await tx.run(
    'INSERT INTO juegos(nombre, descripcion, genero, imagen) VALUES (?, ?, ?, ?)',
    [data.nombre, data.descripcion, data.genero, data.imagen]
  );
  // Luego se relaciona ese juego con cada plataforma elegida.
  for (const platformId of data.platformIds) {
    await tx.run('INSERT INTO juegos_plataformas(juego_id, tipo_recurso_id) VALUES (?, ?)', [result.id, platformId]);
  }
  return result.id;
});

// Actualiza los datos y reemplaza las plataformas asociadas por las nuevas selecciones.
exports.update = (id, data) => transaction(async tx => {
  await tx.run(
    'UPDATE juegos SET nombre = ?, descripcion = ?, genero = ?, imagen = ? WHERE id = ?',
    [data.nombre, data.descripcion, data.genero, data.imagen, id]
  );
  // Elimina las relaciones anteriores para que no queden plataformas desmarcadas.
  await tx.run('DELETE FROM juegos_plataformas WHERE juego_id = ?', [id]);
  for (const platformId of data.platformIds) {
    await tx.run('INSERT INTO juegos_plataformas(juego_id, tipo_recurso_id) VALUES (?, ?)', [id, platformId]);
  }
});

// Borra el juego; la clave foránea también borra sus relaciones con plataformas.
exports.delete = id => run('DELETE FROM juegos WHERE id = ?', [id]);
