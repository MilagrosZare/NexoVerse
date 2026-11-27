// Las rutas de autenticación apuntan a los métodos del controlador de cuentas.
const express = require('express');
const controller = require('../controllers/auth.controller');
const router = express.Router();

router.get('/registro', controller.registrationForm); // Muestra el formulario de alta.
router.post('/registro', controller.register);
router.get('/ingresar', controller.loginForm); // Muestra el formulario de inicio de sesión.
router.post('/ingresar', controller.login);
router.post('/salir', controller.logout);

module.exports = router;
