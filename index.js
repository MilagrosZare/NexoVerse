// Lee las variables de entorno desde el archivo ".env". || "Quiet:" para que no aparezca los mensajes por consola cuando se cargan las variables desde .env
require('dotenv').config({ quiet: true });

//Se utiliza para encriptar las credenciales.
const crypto = require('crypto');

const express = require('express');

//Sirve para utilizar plantillas generales (layouts) en EJS
const layouts = require('express-ejs-layouts');

//Sirve para utilizar métodos HTTP como PUT, PATCH y DELETE desde formularios HTML
const methodOverride = require('method-override');

//Importamos el módulo 'path' para trabajar con rutas de archivos y directorios
const path = require('path');

// Al cargar sqlite.js se abre la base de datos y se crean sus tablas si todavía no existen.
require('./src/models/sqlite');

// Los modelos guardan las consultas a la base; User se usa acá para reconocer la sesión.
const User = require('./src/models/User');

// app representa el servidor Express al que se le agregan configuración y rutas.
const app = express();

// Permite que un formulario POST pueda pedir DELETE agregando ?_method=DELETE a su URL.
app.use(methodOverride('_method'));

// Se configura EJS como motor de planitllas para renderizar vistas
app.set('view engine', 'ejs');

//Configuramos la carpeta views donde se encuentran las vistas EJS
app.set('views', path.join(__dirname, 'src/views'));

app.use(layouts);
app.set('layout', 'layouts/layout');

// Permite leer los campos enviados por formularios HTML. El límite evita aceptar cuerpos enormes.
app.use(express.urlencoded({ extended: false, limit: '20kb' }));


// Middleware que publica imágenes, hojas de estilo y otros archivos estáticos desde public/.
app.use(express.static(path.join(__dirname, 'public')));


/*
-----------------------------------------------------------------------
                VERIFICACIÓN DE SESIÓN MEDIANTE COOKIES
-----------------------------------------------------------------------
*/

// La cookie contiene un identificador firmado y una fecha de vencimiento. La firma permite detectar cambios.
const cookieName = 'gaming_session';
const secret = process.env.SESSION_SECRET || 'cambiar-esta-clave-local-antes-de-publicar';
//Crea una firma con el algoritmo SHA-256 y una clave secreta, crea una firma digital y la devuelve como texto
const sign = value => crypto.createHmac('sha256', secret).update(value).digest('base64url');
app.use(async (req, res, next) => {
  // Por defecto la visita es anónima; si la cookie es válida, buscamos al usuario en SQLite.
  res.locals.user = null;
  //Busca la cookie de sesión
  const raw = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${cookieName}=`));
  //Separa los datos entre payload y signature
  if (raw) {
    try {
      const [payload, signature] = decodeURIComponent(raw.slice(cookieName.length + 1)).split('.');
      //timingSafeEqual compara la firma recibida con la calculada. Si hay errores, puede lanzar un error.
      const expected = sign(payload);
      if (signature && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        //Convierte el JSON en un objeto JavaScript.
        const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
        if (session.exp > Date.now()) res.locals.user = await User.findPublicById(session.uid);
      }
    } catch (_) { /* Cookie inválida: se trata como sesión cerrada. */ }
  }
  req.user = res.locals.user;
  // next() deja que Express continúe con el siguiente middleware o con la ruta solicitada.
  next();
});


// Estos datos quedan disponibles en todas las vistas EJS.
app.use((req, res, next) => {
  res.locals.flash = req.query.mensaje || '';
  res.locals.path = req.path;
  next();
});

/*
-----------------------------------------------------------------------
                        DEFINIMOS LAS RUTAS
-----------------------------------------------------------------------
*/

// Cada router agrupa las direcciones relacionadas con una sección del sitio.
app.use('/', require('./src/routes/main.router'));
app.use('/juegos', require('./src/routes/juegos.router'));
app.use('/auth', require('./src/routes/auth.router'));
app.use('/reservas', require('./src/routes/reservas.router'));
app.use('/reservar', require('./src/routes/reservar.router'));
app.use('/contacto', require('./src/routes/contacto.router'));

//Agrega el panel privado; sus rutas verifican el rol administrador.
app.use('/admin', require('./src/routes/admin.router'));

// Si ninguna ruta respondió, mostramos la página 404.
app.use((req, res) => res.status(404).render('errors/404'));

//Express reconoce manejador de errores porque tiene CUATRO parámetros (error, re, res, next). El error 505 se ejecuta cuando algo lanza una excepción o cuando una ruta llama a next(error). Es la red de seguridad de toda la app.
app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  res.status(500).render('errors/500');
});

/*
-----------------------------------------------------------------------
      DEFINIMOS PUERTO DE CONEXIÓN Y EJECUCIÓN DEL SERVIDOR
-----------------------------------------------------------------------
*/

//Define el puerto en el que se ejecutará el servidor
const PORT = process.env.PORT || 3010;

// Inicia el servidor y deja la aplicación escuchando solicitudes HTTP.
app.listen(PORT, () => console.log(`Salas Gaming está disponible en http://localhost:${PORT}`));

module.exports = app;
