const db = require('./sqlite');

// all() devuelve una lista, aunque la consulta encuentre cero filas.
exports.all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
});

// one() devuelve una sola fila; es útil para buscar un usuario o recurso por su ID.
exports.one = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
});

// run() se usa para insertar, cambiar o borrar datos. También informa el ID y la cantidad de filas afectadas.
// runNow no entra a la cola por sí sola; se usa desde run() o desde una transacción ya protegida.
const runNow = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (error) {
    if (error) reject(error);
    else resolve({ id: this.lastID, changes: this.changes });
  });
});

// SQLite usa una sola conexión. Esta cola hace que las escrituras normales y las transacciones esperen su turno.
let writeQueue = Promise.resolve();
const serializedWrite = operation => {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.catch(() => {});
  return result;
};

exports.run = (sql, params = []) => serializedWrite(() => runNow(sql, params));

// Una transacción agrupa varias operaciones: se guardan todas juntas o se deshacen todas si algo falla.
exports.transaction = operation => serializedWrite(async () => {
  // IMMEDIATE reserva el turno de escritura antes de revisar disponibilidad y guardar la reserva.
  await runNow('BEGIN IMMEDIATE');
  try {
    const result = await operation({ all: exports.all, one: exports.one, run: runNow });
    await runNow('COMMIT');
    return result;
  } catch (error) {
    await runNow('ROLLBACK');
    throw error;
  }
});
