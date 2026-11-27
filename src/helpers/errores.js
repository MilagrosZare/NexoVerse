
// ERROR 400: Solicitud incorrecta
const badRequest = (res, mensaje, volver = '/', textoVolver = 'Volver al inicio') => {
    return res.status(400).render('errors/400', {
        mensaje,
        volver,
        textoVolver
    });
};

// ERROR 404: Recurso no encontrado
const notFound = (res, mensaje, volver = '/', textoVolver = 'Volver al inicio') => {
    return res.status(404).render('errors/404', {
        mensaje,
        volver,
        textoVolver
    });
};

// ERROR 500: Error interno del servidor
const serverError = (res, error, volver = '/', textoVolver = 'Volver al inicio') => {
    console.error(error);

    return res.status(500).render('errors/500', {
        mensaje: 'Ocurrió un problema inesperado con el servidor.',
        volver,
        textoVolver
    });
};

module.exports = {
    badRequest,
    notFound,
    serverError
};
