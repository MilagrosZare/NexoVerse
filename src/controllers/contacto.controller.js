const nodemailer = require('nodemailer');

const fields = ['nombre', 'email', 'fecha_evento', 'invitados', 'motivo', 'mensaje'];
const validMotives = ['Cumpleaños', 'Evento grupal', 'Alquiler especial', 'Otra consulta'];

// GET: muestra el formulario sin valores previos ni errores.
exports.index = (req, res) => res.render('contacto/index', { error: '', valores: {} });

// POST: limpia y revisa lo recibido antes de preparar el mensaje de correo.
exports.submit = async (req, res) => {
  const valores = Object.fromEntries(fields.map(key => [key, String(req.body[key] || '').trim()]));
  const validEventDate = !valores.fecha_evento || (
    /^\d{4}-\d{2}-\d{2}$/.test(valores.fecha_evento) &&
    !Number.isNaN(Date.parse(`${valores.fecha_evento}T12:00:00Z`)) &&
    new Date(`${valores.fecha_evento}T12:00:00Z`).toISOString().slice(0, 10) === valores.fecha_evento
  );
  const validGuests = !valores.invitados || (
    /^\d+$/.test(valores.invitados) && Number(valores.invitados) >= 1 && Number(valores.invitados) <= 500
  );
  if (!valores.nombre || valores.nombre.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.email) || valores.email.length > 200 ||
      !validMotives.includes(valores.motivo) || !validEventDate || !validGuests ||
      valores.mensaje.length < 10 || valores.mensaje.length > 3000) {
    return res.status(400).render('contacto/index', {
      error: 'Completá nombre, correo, motivo y un mensaje de al menos 10 caracteres. Revisá también la fecha y los invitados.',
      valores
    });
  }

  // No se intenta enviar el mensaje si faltan credenciales; se informa cómo habilitar SMTP.
  const configured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.CONTACT_TO;
  if (!configured) {
    return res.status(503).render('contacto/index', {
      error: 'El formulario está listo, pero falta configurar el envío de correo en el archivo .env.',
      valores
    });
  }

  try {
    // Nodemailer conecta con el servidor SMTP configurado en .env.
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 2525),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.CONTACT_TO,
      replyTo: valores.email,
      subject: `Consulta gaming: ${valores.motivo}`,
      text: `Nombre: ${valores.nombre}\nCorreo: ${valores.email}\nFecha del evento: ${valores.fecha_evento || 'Sin definir'}\nInvitados: ${valores.invitados || 'Sin definir'}\nMotivo: ${valores.motivo}\n\n${valores.mensaje}`
    });
    res.render('contacto/exito', { nombre: valores.nombre });
  } catch (error) {
    console.error('No se pudo enviar la consulta:', error.message);
    res.status(503).render('contacto/index', {
      error: 'No se pudo enviar la consulta. Revisá la configuración del correo e intentá nuevamente.',
      valores
    });
  }
};
