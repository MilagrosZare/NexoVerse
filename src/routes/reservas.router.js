// Esta sección es para ver y cancelar las reservas que ya pertenecen al cliente.
const express = require('express');
const { requerirSesion } = require('../helpers/auth');
const controller = require('../controllers/reservas.controller');
const router = express.Router();

router.use(requerirSesion); // No deja consultar reservas sin iniciar sesión.
router.get('/', controller.index); // GET /reservas muestra el historial propio.
router.delete('/:id', controller.cancel); // DELETE /reservas/123 cancela una reserva.

module.exports = router;
