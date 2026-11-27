
# **NexoVerse Gaming**

## Descripción

NexoVerse Gaming es una aplicación web para la gestión de un local de salas y equipos de videojuegos. Reúne en un mismo sistema el catálogo de juegos, las plataformas disponibles, los recursos del establecimiento y las reservas de sus clientes.

El proyecto está desarrollado con **Node.js**, **Express**, **EJS** y **SQLite**. La interfaz utiliza plantillas EJS y archivos estáticos del directorio `public`.

## Funcionalidades

### Clientes

- Crear una cuenta e iniciar o cerrar sesión.
- Consultar el catálogo de juegos y filtrar sus títulos por plataforma.
- Consultar equipos, salas y horarios disponibles.
- Crear reservas individuales o grupales, consultar las propias y cancelarlas.
- Enviar consultas por eventos y alquileres especiales mediante el formulario de contacto.

### Administración

- Crear, editar y eliminar juegos y sus asociaciones con plataformas.
- Agregar y retirar recursos del local, como PC, consolas y salas.
- Consultar las reservas de los clientes, generar reservas en su nombre, cambiar fecha u horario y cancelarlas.

Las cancelaciones cambian el estado de la reserva a `CANCELADA` para conservar el historial. Cuando una reserva grupal utiliza varias PC, el sistema vincula sus filas para poder gestionarlas en conjunto. Los recursos que tienen reservas históricas no se eliminan de la base.

## Organización del proyecto

```text
index.js                  Configuración e inicio de Express
src/
  controllers/             Lógica que atiende cada solicitud
  helpers/                 Comprobaciones reutilizables, como los permisos
  models/                   Consultas y operaciones sobre SQLite
  routes/                   Direcciones y métodos HTTP de cada sección
  views/                    Plantillas EJS agrupadas por página
public/                     Hojas de estilo, imágenes y otros archivos estáticos
datos.db                    Base de datos SQLite del proyecto
```

El recorrido principal de una solicitud es **ruta → controlador → modelo → SQLite**. Cuando corresponde mostrar una página, el controlador entrega sus datos a una vista EJS.

## Datos principales

La base de datos organiza la información en estas tablas:

- `usuarios`: cuentas de clientes y administradores, con sus roles.
- `tipos_recursos`: plataformas como PC, PlayStation y Xbox.
- `recursos`: equipos individuales y salas pertenecientes a una plataforma.
- `reservas`: turnos asociados a un cliente y a uno o más recursos.
- `juegos`: información descriptiva de los títulos del catálogo.
- `juegos_plataformas`: relación entre juegos y plataformas; permite asociar un juego con varias plataformas.

## Acceso y protección

Las contraseñas se almacenan mediante `scrypt`. La sesión se mantiene con una cookie firmada y el servidor comprueba el rol de la cuenta antes de permitir el acceso a las rutas administrativas. Las consultas a SQLite utilizan parámetros para separar los valores recibidos del texto SQL.

El formulario de contacto valida la información y envía el mensaje a través de SMTP con Nodemailer. Las consultas de contacto no se guardan en una tabla de la base de datos.
