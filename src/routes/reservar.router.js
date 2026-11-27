// Esta sección es para crear una reserva nueva; requiere que el cliente haya iniciado sesión.
const express = require('express');
const { requerirSesion } = require('../helpers/auth');
const controller = require('../controllers/reservar.controller');
const router = express.Router();

router.use(requerirSesion); // Protege todas las rutas que siguen.
router.get('/', controller.new); // GET /reservar muestra el formulario.
router.get('/disponibilidad', controller.availability); // Devuelve horarios disponibles como JSON.
router.post('/', controller.create); // POST /reservar valida y confirma el turno.

module.exports = router;
