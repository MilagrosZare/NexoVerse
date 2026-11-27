const Game = require('../models/Game');
const Reservation = require('../models/Reservation');
const Resource = require('../models/Resource');

// Prepara los datos que necesita la portada y luego se los entrega a la vista index.ejs.
exports.index = async (req, res, next) => {
  try {
    const [recursos, juegos, reservas] = await Promise.all([
      Resource.listAvailable(),
      Game.list(null, 8),
      req.user ? Reservation.listRecentByUser(req.user.id, 5) : Promise.resolve([])
    ]);
    res.render('index', { recursos, juegos, reservas });
  } catch (error) {
    next(error);
  }
};
