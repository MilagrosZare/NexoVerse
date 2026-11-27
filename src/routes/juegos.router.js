// Este router agrupa las direcciones del catálogo.
const express = require('express');
const controller = require('../controllers/juegos.controller');
const router = express.Router();

router.get('/', controller.index); // GET /juegos muestra y filtra el catálogo.

module.exports = router;
