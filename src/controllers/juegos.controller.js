const Game = require('../models/Game');

// Lee el filtro de plataforma, pide los juegos al modelo y renderiza el catálogo.
exports.index = async (req, res, next) => {
  try {
    const tipos = await Game.listPlatforms();
    const plataforma = Number(req.query.plataforma) || null;
    const juegos = await Game.list(plataforma);
    res.render('juegos/index', { juegos, tipos, plataforma });
  } catch (error) {
    next(error);
  }
};
