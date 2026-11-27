// Express permite agrupar todas las páginas del administrador en un router.
const express = require('express');
// Este middleware comprueba que la cuenta tenga rol ADMIN.
const { requerirAdmin } = require('../helpers/auth');
// Importa las funciones que procesan los formularios y cargan las vistas.
const controller = require('../controllers/admin.controller');
const router = express.Router();

// Protege todas las rutas que se declaran a continuación.
router.use(requerirAdmin);
// Abre la portada del panel.
router.get('/', controller.index);
// Rutas para listar, crear, editar y quitar juegos.
router.get('/juegos', controller.games);
router.get('/juegos/nuevo', controller.newGameForm);
router.post('/juegos', controller.createGame);
router.get('/juegos/:id/editar', controller.editGameForm);
router.put('/juegos/:id', controller.updateGame);
router.delete('/juegos/:id', controller.deleteGame);
// Rutas para listar, crear y quitar recursos.
router.get('/recursos', controller.resources);
router.post('/recursos', controller.createResource);
router.delete('/recursos/:id', controller.deleteResource);
// Rutas para listar, crear, cambiar el horario y cancelar reservas.
router.get('/reservas', controller.reservations);
router.get('/reservas/nueva', controller.newReservationForm);
router.post('/reservas', controller.createReservation);
router.get('/reservas/:id/editar', controller.editReservationForm);
router.put('/reservas/:id', controller.updateReservationSchedule);
router.delete('/reservas/:id', controller.cancelReservation);

// Exporta el router para que index.js pueda conectarlo.
module.exports = router;