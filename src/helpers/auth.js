// Middleware: corre antes del controlador y comprueba si existe un usuario en la sesión.
exports.requerirSesion = (req, res, next) => {
  if (!req.user) return res.redirect('/auth/ingresar?mensaje=Iniciá sesión para continuar');
  next();
};

//Deja pasar solo cuentas con rol ADMIN a las rutas de administración.
exports.requerirAdmin = (req, res, next) => {
  // Si no hay sesión iniciada, llega al formulario de acceso.
  if (!req.user) return res.redirect('/auth/ingresar?mensaje=Iniciá sesión para continuar');
  // Si hay sesión pero el rol no es ADMIN, muestra el error 403.
  if (req.user.rol !== 'ADMIN') return res.status(403).render('errors/403');
  // Si el rol es ADMIN, Express continúa con la ruta solicitada.
  next();
};