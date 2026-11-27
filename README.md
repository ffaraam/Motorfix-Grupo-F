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

## API REST

Las rutas usan JSON cuando reciben un cuerpo y sesiones mediante cookie `motorfix.sid`. Las rutas de turnos requieren sesión. Los permisos se indican por endpoint.

### Autenticación

| Método | Ruta | Función | Datos |
|---|---|---|---|
| `POST` | `/api/auth/register` | Registra un cliente e inicia sesión. | `{ "nombre", "email", "telefono", "password" }` |
| `POST` | `/api/auth/login` | Inicia sesión y devuelve el rol. | `{ "email", "password" }` |
| `GET` | `/api/auth/me` | Devuelve la identidad de la sesión actual. | Requiere sesión. |
| `POST` | `/api/auth/logout` | Cierra la sesión actual. | Cookie de sesión. |

### Clientes

| Método | Ruta | Permiso | Función y datos |
|---|---|---|---|
| `GET` | `/api/appointments/services` | Cliente | Lista servicios, precios, duración y disponibilidad. |
| `GET` | `/api/appointments/availability?serviceId=...&date=YYYY-MM-DD` | Cliente | Consulta horarios disponibles para servicio y fecha. |
| `POST` | `/api/appointments` | Cliente | Crea una solicitud. JSON: `{ "serviceId", "vehicle": { "make", "model" }, "date", "startTime" }`. |
| `GET` | `/api/appointments/mine` | Cliente | Lista los turnos e historial del cliente autenticado. |
| `PATCH` | `/api/appointments/:appointmentId/cancel` | Cliente | Cancela un turno propio que cumpla las reglas de cancelación. No requiere cuerpo. |

### Jefe de taller

| Método | Ruta | Permiso | Función y datos |
|---|---|---|---|
| `GET` | `/api/appointments/management` | Jefe | Consulta agenda, elevadores, mecánicos y tablero. |
| `GET` | `/api/appointments/management/settings` | Jefe | Consulta servicios y configuración operativa. |
| `PUT` | `/api/appointments/management/settings` | Jefe | Actualiza catálogo y reglas. JSON: `{ "services": [{ "id", "name", "description", "estimatedPrice", "durationMinutes", "enabled", "suppliesAvailable" }], "workshop": { "businessDays", "openingTime", "closingTime", "slotIntervalMinutes", "maxDailyAppointments" } }`. |
| `GET` | `/api/appointments/management/daily-report?date=YYYY-MM-DD` | Jefe | Consulta el reporte de vehículos de una fecha; `date` es opcional. |
| `PATCH` | `/api/appointments/management/:appointmentId` | Jefe | Cambia el estado del turno. JSON: `{ "status": "confirmado" | "rechazado" | "finalizado" }`. |
| `PATCH` | `/api/appointments/management/:appointmentId/vehicle-status` | Jefe | Cambia el estado del vehículo. JSON: `{ "vehicleStatus": "En Taller" | "En Reparación" | "Esperando Repuesto" | "Listo para Retirar" }`. |
| `PATCH` | `/api/appointments/management/:appointmentId/lift` | Jefe | Asigna elevador a un turno. JSON: `{ "liftId": "elevador-1" }`. |
| `PATCH` | `/api/appointments/management/lifts/:liftId` | Jefe | Habilita/deshabilita elevador. JSON: `{ "enabled": true }` o `{ "enabled": false }`. |
| `PATCH` | `/api/appointments/management/mechanics/:mechanicId/lift` | Jefe | Asigna mecánico a elevador. JSON: `{ "liftId": "elevador-1" }`. |

### Mecánico

| Método | Ruta | Permiso | Función |
|---|---|---|---|
| `GET` | `/api/appointments/mechanic` | Mecánico | Consulta los trabajos aprobados vigentes o futuros del elevador asociado a su cuenta. |

### Respuestas y reglas

- Las rutas privadas responden `401` si no hay sesión y `403` si el rol no tiene permiso.
- El backend valida datos, disponibilidad, capacidad, propiedad del turno y reglas de negocio; el frontend no determina precios ni estados válidos.
- Errores de validación suelen responder `400`; conflictos de capacidad o estado, `409`; operaciones no reservables, `422`; recurso inexistente, `404`.

## Cuentas de prueba

### Jefe de taller

| Correo | Contraseña |
|---|---|
| `admin@gmail.com` | `motorfix1714` |

### Mecánicos

| Elevador inicial | Correo | Contraseña |
|---|---|---|
| Elevador 1 | `motorfix1@gmail.com` | `motorfix1714` |
| Elevador 2 | `motorfix2@gmail.com` | `motorfix1417` |
| Elevador 3 | `motorfix3@gmail.com` | `motorfix1174` |
| Elevador 4 | `motorfix4@gmail.com` | `motorfix1147` |

