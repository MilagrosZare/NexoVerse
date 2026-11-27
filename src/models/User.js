const { all, one, run } = require('./query');

// Busca el usuario por ID y devuelve solo los datos públicos.
exports.findPublicById = id => one(
  'SELECT id, nombre, apellido, email, rol FROM usuarios WHERE id = ?',
  [id]
);

// Busca la cuenta por correo. COLLATE NOCASE hace que la búsqueda no distinga entre mayúsculas y minúsculas.
exports.findByEmail = email => one(
  'SELECT * FROM usuarios WHERE email = ? COLLATE NOCASE',
  [email]
);

// Devuelve la lista de clientes para que el administrador los elija en un formulario.
exports.listClients = () => all(
  "SELECT id, nombre, apellido, email FROM usuarios WHERE rol = 'CLIENTE' ORDER BY apellido, nombre"
);

// Comprueba que un ID pertenezca a una cuenta cliente, no a otra cuenta.
exports.findClientById = id => one(
  "SELECT id FROM usuarios WHERE id = ? AND rol = 'CLIENTE'", [id]
);

// Crea una fila nueva en la tabla usuarios para alojar el registro.
exports.createClient = data => run(
  `INSERT INTO usuarios(nombre, apellido, email, usuario, password, rol)
  VALUES (?, ?, ?, ?, ?, 'CLIENTE')`, //la tabla conserva la columna usuario heredada; el correo sirve para completarla.
  [data.nombre, data.apellido, data.email, data.email, data.password]
);
