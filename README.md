# MotorFix

Plataforma local para gestionar turnos y la operación de un taller mecánico.

## Estructura

- `config/`: plantillas iniciales del taller, servicios y cuentas internas.
- `data/`: datos persistidos en JSON y sesiones locales. No versionar su contenido.
- `src/routes/`: endpoints HTTP de autenticación y turnos.
- `src/services/`: reglas de negocio y persistencia local.
- `src/middleware/`: autenticación y autorización por rol.
- `src/validation/`: validación de datos de entrada.
- `pages/`: pantallas HTML.
- `js/`: comportamiento de las pantallas en el navegador.
- `css/`: estilos del sitio.
- `images/`: imágenes y favicon.
- `specs/`: documentos detallados de requisitos y diseño; se mantienen fuera del repositorio.
- `server.js`: configuración e inicio de Express.

## Ejecución local

Requiere Node.js 20 o superior.

```sh
npm install
npm start
```

Abrir <http://localhost:3000>.
