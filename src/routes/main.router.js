// Las rutas solo relacionan una dirección del sitio con el método que la atiende.
const express = require('express');
const router = express.Router();
const controller = require('../controllers/main.controller');
router.get('/', controller.index); // GET / muestra la portada.
module.exports = router;
