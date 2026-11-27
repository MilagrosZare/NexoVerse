// crypto permite proteger contraseñas y firmar la cookie de sesión.
const crypto = require('crypto');
// User contiene las consultas para buscar y crear cuentas en SQLite.
const User = require('../models/User');

// Quita espacios al principio y al final de un dato escrito en el formulario.
const normalize = value => String(value || '').trim();

// Comprueba de manera sencilla que el correo tenga texto antes y después de @ y un punto al final.
const emailLooksValid = email => {
  const atPosition = email.indexOf('@');
  const lastDotPosition = email.lastIndexOf('.');
  const onlyOneAt = atPosition === email.lastIndexOf('@');
  const noSpaces = !email.includes(' ');

  return atPosition > 0 &&
    onlyOneAt &&
    lastDotPosition > atPosition + 1 &&
    lastDotPosition < email.length - 1 &&
    noSpaces;
};

// Convierte una contraseña en un hash. La sal aleatoria permite que cada cuenta tenga un hash distinto.
const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) {
        reject(error);
        return;
      }

      // Guarda la sal y el hash juntos, separados por dos puntos.
      const hash = key.toString('hex');
      resolve(`${salt}:${hash}`);
    });
  });
};

// GET: muestra el formulario para crear una cuenta.
exports.registrationForm = (req, res) => {
  res.render('auth/registro', { error: '' });
};

// POST: revisa los datos, protege la contraseña y crea una cuenta de cliente.
exports.register = async (req, res, next) => {
  // Lee los datos enviados y limpia los espacios sobrantes.
  const data = {
    nombre: normalize(req.body.nombre),
    apellido: normalize(req.body.apellido),
    email: normalize(req.body.email).toLowerCase(),
    password: String(req.body.password || '')
  };

  // Comprueba los campos en el servidor, aunque el formulario también los revise.
  const missingName = !data.nombre || data.nombre.length > 80;
  const missingLastName = !data.apellido || data.apellido.length > 80;
  const invalidEmail = !emailLooksValid(data.email) || data.email.length > 200;
  const invalidPassword = data.password.length < 8 || data.password.length > 128;

  if (missingName || missingLastName || invalidEmail || invalidPassword) {
    return res.status(400).render('auth/registro', {
      error: 'Completá los campos. La contraseña debe tener entre 8 y 128 caracteres.'
    });
  }

  try {
    // Reemplaza la contraseña original por su versión protegida antes de guardarla.
    data.password = await hashPassword(data.password);
    await User.createClient(data);

    // Después del registro, lleva a la persona al formulario para iniciar sesión.
    res.redirect('/auth/ingresar?mensaje=Cuenta creada. Ya podés iniciar sesión');
  } catch (error) {
    // SQLite usa UNIQUE para impedir que se repita un correo.
    if (String(error.message).includes('UNIQUE')) {
      return res.status(409).render('auth/registro', {
        error: 'Ese correo ya está registrado.'
      });
    }

    // Los errores inesperados pasan al manejador general de Express.
    next(error);
  }
};

// GET: muestra el formulario para iniciar sesión.
exports.loginForm = (req, res) => {
  res.render('auth/ingresar', { error: '' });
};

// POST: busca la cuenta y comprueba la contraseña antes de iniciar sesión.
exports.login = async (req, res, next) => {
  try {
    // El proyecto permite iniciar sesión con el correo.
    const email = normalize(req.body.email).toLowerCase();
    const user = await User.findByEmail(email);

    // Si el correo no existe, muestra un error y no continúa con la comprobación.
    if (!user) {
      return res.status(401).render('auth/ingresar', {
        error: 'Correo o contraseña incorrectos.'
      });
    }
    
    // Si el correo no existe, muestra un error y no continúa con la comprobación.
    if (!user) {
      return res.status(401).render('auth/ingresar', {
        error: 'Correo o contraseña incorrectos.'
      });
    }

    // La base guarda la sal y el hash juntos con el formato "sal:hash".
    const passwordParts = user.password.split(':');
    const salt = passwordParts[0];
    const savedHash = passwordParts[1];

    // Calcula el hash de la contraseña escrita usando la sal de esta cuenta.
    const enteredPassword = await hashPassword(String(req.body.password || ''), salt);
    const enteredHash = enteredPassword.split(':')[1];

    // Si los hashes no coinciden, la contraseña ingresada no es la correcta.
    if (savedHash !== enteredHash) {
      return res.status(401).render('auth/ingresar', {
        error: 'Correo o contraseña incorrectos.'
      });
    }

    // La sesión contiene el ID del usuario y el momento en que vence, dentro de una semana.
    const sessionData = {
      uid: user.id,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000
    };
    const payload = Buffer.from(JSON.stringify(sessionData)).toString('base64url');

    // La firma permite que index.js detecte si alguien cambia los datos de la sesión.
    const secret = process.env.SESSION_SECRET || 'cambiar-esta-clave-local-antes-de-publicar';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64url');

    // El navegador guarda la cookie por una semana; index.js la lee en cada solicitud.
    res.setHeader('Set-Cookie', `gaming_session=${payload}.${signature}; Path=/; Max-Age=604800`);
    res.redirect('/');
  } catch (error) {
    // Pasa los errores de base de datos o del servidor al manejador general.
    next(error);
  }
};

// POST: elimina la cookie de sesión del navegador para cerrar la cuenta.
exports.logout = (req, res) => {
  // Max-Age=0 indica que la cookie debe borrarse inmediatamente.
  res.setHeader('Set-Cookie', 'gaming_session=; Path=/; Max-Age=0');
  res.redirect('/');
};