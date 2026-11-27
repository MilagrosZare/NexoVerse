const path = require('path');
const sqlite = require('sqlite3');

// Apunta al archivo de base de datos. 
const db = new sqlite.Database(path.resolve(__dirname, '../../datos.db'), error => {
  if (error) return console.error('No se pudo abrir SQLite:', error.message);
  // serialize le indica a SQLite que ejecute las instrucciones una después de la otra, en el orden escrito.
  db.serialize(() => {
    // SQLite desactiva las claves foráneas por defecto; se reactiva la conexión ya que las necesita para validar relaciones.
    db.run('PRAGMA foreign_keys = ON');
    //Guarda las cuentas.
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, apellido TEXT NOT NULL,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE, usuario TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password TEXT NOT NULL, rol TEXT NOT NULL DEFAULT 'CLIENTE' CHECK (rol IN ('CLIENTE','ADMIN'))
    )`);
    // Guarda los tipos de plataforma: PC, PlayStation, Xbox.
    db.run(`CREATE TABLE IF NOT EXISTS tipos_recursos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL UNIQUE, descripcion TEXT
    )`);
    // Guarda cada equipo o sala, indica a qué plataforma pertenece.
    db.run(`CREATE TABLE IF NOT EXISTS recursos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, tipo_recurso_id INTEGER NOT NULL,
      nombre TEXT NOT NULL UNIQUE, modalidad_recurso TEXT NOT NULL CHECK (modalidad_recurso IN ('INDIVIDUAL','SALA')),
      capacidad_maxima INTEGER NOT NULL DEFAULT 1 CHECK (capacidad_maxima > 0),
      estado TEXT NOT NULL DEFAULT 'DISPONIBLE' CHECK (estado IN ('DISPONIBLE','MANTENIMIENTO')),
      descripcion TEXT, FOREIGN KEY (tipo_recurso_id) REFERENCES tipos_recursos(id)
    )`);
    // Guarda turnos. codigo_grupo une varias PC cuando un equipo reserva en modalidad TEAM.
    db.run(`CREATE TABLE IF NOT EXISTS reservas (
      id INTEGER PRIMARY KEY AUTOINCREMENT, usuario_id INTEGER NOT NULL, recurso_id INTEGER NOT NULL,
      modalidad_juego TEXT NOT NULL CHECK (modalidad_juego IN ('SOLO','TEAM')),
      cantidad_personas INTEGER NOT NULL CHECK (cantidad_personas > 0), fecha TEXT NOT NULL,
      hora_inicio TEXT NOT NULL, duracion INTEGER NOT NULL CHECK (duracion IN (1,2,3)), hora_fin TEXT NOT NULL,
      codigo_grupo TEXT, estado TEXT NOT NULL DEFAULT 'CONFIRMADA' CHECK (estado IN ('CONFIRMADA','CANCELADA')),
      creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id), FOREIGN KEY (recurso_id) REFERENCES recursos(id)
    )`);
    // Datos principales de cada juego del catálogo.
    db.run(`CREATE TABLE IF NOT EXISTS juegos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, descripcion TEXT, genero TEXT, imagen TEXT
    )`);

    // Tabla puente: permite que un juego esté en varias plataformas y viceversa.
    db.run(`CREATE TABLE IF NOT EXISTS juegos_plataformas (
      id INTEGER PRIMARY KEY AUTOINCREMENT, juego_id INTEGER NOT NULL, tipo_recurso_id INTEGER NOT NULL,
      UNIQUE (juego_id, tipo_recurso_id), FOREIGN KEY (juego_id) REFERENCES juegos(id) ON DELETE CASCADE,
      FOREIGN KEY (tipo_recurso_id) REFERENCES tipos_recursos(id) ON DELETE CASCADE
    )`);

/* 
------------------------------------------------------------------------
Í N D I C E S: ayudan a SQLite a encontrar datos más rápido. Se utiliza para acelerar búsquedas.
------------------------------------------------------------------------
*/

    db.run('CREATE INDEX IF NOT EXISTS idx_reservas_recurso_horario ON reservas(recurso_id, fecha, hora_inicio, hora_fin, estado)');
    db.run('CREATE INDEX IF NOT EXISTS idx_reservas_usuario ON reservas(usuario_id, fecha)');
    // INSERT OR IGNORE permite iniciar el programa más de una vez sin duplicar los ejemplos.
    db.run(`INSERT OR IGNORE INTO tipos_recursos(nombre, descripcion) VALUES
      ('PC', 'Computadoras gamer individuales'), ('PlayStation', 'Consolas PlayStation'), ('Xbox', 'Consolas Xbox')`);
    db.run(`INSERT OR IGNORE INTO recursos(tipo_recurso_id, nombre, modalidad_recurso, capacidad_maxima, descripcion)
      SELECT id, 'PC-0' || n, 'INDIVIDUAL', 1, 'PC Gamer con periféricos' FROM tipos_recursos, (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) WHERE nombre='PC'`);
    db.run(`INSERT OR IGNORE INTO recursos(tipo_recurso_id, nombre, modalidad_recurso, capacidad_maxima, descripcion)
      SELECT id, nombre || '-01', 'INDIVIDUAL', 4, 'Consola para juego compartido' FROM tipos_recursos WHERE nombre IN ('PlayStation','Xbox')`);
    db.run(`INSERT OR IGNORE INTO recursos(tipo_recurso_id, nombre, modalidad_recurso, capacidad_maxima, descripcion)
      SELECT id, 'SALA-' || upper(nombre) || '-01', 'SALA', 8, 'Sala privada equipada' FROM tipos_recursos WHERE nombre IN ('PlayStation','Xbox')`);
  });
});

module.exports = db;
