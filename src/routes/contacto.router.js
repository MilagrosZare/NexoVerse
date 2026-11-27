// GET muestra el formulario; POST recibe y envía la consulta.
const express = require('express');
const controller = require('../controllers/contacto.controller');
const router = express.Router();

router.get('/', controller.index);
router.post('/', controller.submit);

module.exports = router;
