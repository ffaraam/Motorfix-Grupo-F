# Especificación: backend de servicios, disponibilidad y turnos

**Proyecto:** MotorFix  
**Versión:** 1.0  
**Estado:** Implementación local activa; reglas de operación actualizadas por el negocio  
**Alcance:** consultar servicios/disponibilidad y registrar una solicitud de turno para el cliente autenticado.

## 1. Objetivo

Conectar la página de solicitud con el servidor MotorFix para que el cliente autenticado seleccione un servicio, ingrese marca y modelo, consulte horarios y registre una reserva sin seleccionar elevador. El jefe de taller asigna luego un elevador desde su panel; el servidor valida que no se superpongan reservas.

## 2. Decisiones y límites

- Se utiliza Node.js, Express y persistencia local JSON, siguiendo RNF-06/RNF-07.
- Los servicios se guardan en `data/services.json`, las reglas operativas iniciales en `data/workshop.json` y las solicitudes en `data/appointments.json`.
- El servidor atribuye cada solicitud al usuario de la sesión; el cliente no puede elegir ni falsificar `userId`, estado, precio o duración.
- Los turnos activos (`solicitado` y `confirmado`) cuentan contra el máximo diario. Los turnos asignados ocupan el elevador durante su franja; los no asignados reservan una unidad de capacidad disponible. Rechazar una solicitud libera capacidad. La cancelación por el cliente aún no está implementada.
- Las fechas y horas de la API usan hora local del taller, configurada como `America/Argentina/Buenos_Aires`.
- Los datos confirmados por el negocio son 4 elevadores, un máximo de 4 turnos diarios y atención de lunes a sábado de 08:00 a 19:00. Los inicios disponibles se ofrecen en intervalos de 60 minutos; la duración depende del servicio.
- El catálogo incluye los siete servicios con precios fijos en ARS: aceite y filtros $160.000; frenos $225.000; alineación y balanceo $72.500; suspensión y dirección $450.000; sistema eléctrico $110.000; diagnóstico OBD2 $40.000; distribución y correas $450.000. Duraciones definidas respectivamente: 60, 120, 60, 240, 90, 30 y 300 minutos.
- El jefe de taller asigna elevadores, aprueba o rechaza solicitudes y marca como finalizados los trabajos aprobados desde el panel privado. Para aprobar una solicitud `solicitado` primero debe tener un elevador habilitado asignado. Rechazarla libera capacidad. El cliente consulta el estado y el elevador asignado desde su panel; aprobaciones, rechazos y finalizaciones muestran el tiempo transcurrido desde la acción.
- El cliente puede cancelar hasta 2 horas antes del turno según la regla del negocio. El endpoint y la interfaz de cancelación todavía no están implementados.
- Los mecánicos tendrán acceso de solo lectura a los datos del vehículo y el servicio asignado. Solo el jefe podrá habilitar/deshabilitar elevadores, asignarlos a turnos, aceptar/rechazar solicitudes y marcar el trabajo como finalizado.
- El uso asumido es una sola instancia del servidor local. La cola de escrituras serializa las confirmaciones dentro de esa instancia; despliegues concurrentes requieren base de datos/transacciones.

## 3. Configuración inicial

El servidor creará los archivos de `data/` al primer arranque a partir de plantillas versionadas en `config/`.

### Servicios

Cada servicio tendrá `id`, `name`, `description`, `enabled`, `suppliesAvailable`, `durationMinutes`, `durationIsProvisional` y `estimatedPrice`.

La carga inicial contiene cambio de aceite y filtros ($160.000, 60 min), frenos ($225.000, 120 min), alineación y balanceo ($72.500, 60 min), suspensión y dirección ($450.000, 240 min), sistema eléctrico ($110.000, 90 min), diagnóstico OBD2 ($40.000, 30 min), y distribución y correas ($450.000, 300 min). Importes y duraciones están definidos por el taller. `quoteBase` queda en cero para no sumar un importe adicional a los precios acordados. El intervalo de 60 minutos es el paso entre horas de inicio posibles, no la duración de todos los trabajos.

### Taller

La configuración define zona horaria, días/horarios de atención, máximo de turnos diarios, intervalo entre inicios posibles y elevadores. Cada elevador tiene `enabled`; todos comienzan habilitados. Se establecen lunes a sábado, 08:00–19:00, intervalos de 60 minutos, 4 turnos diarios y cuatro elevadores (`elevador-1` a `elevador-4`).

## 4. Persistencia

Un turno tendrá:

```json
{
  "id": "identificador-unico",
  "userId": "id-del-cliente",
  "serviceId": "cambio-aceite-filtros",
  "serviceName": "Cambio de aceite y filtros",
  "vehicle": { "make": "Toyota", "model": "Corolla" },
  "date": "YYYY-MM-DD",
  "startTime": "HH:mm",
  "endTime": "HH:mm",
  "liftId": null,
  "liftName": null,
  "estimatedTotal": 160000,
  "durationMinutes": 60,
  "quoteStatus": "definitiva",
  "status": "solicitado",
  "reviewedBy": null,
  "reviewedAt": null,
  "createdAt": "fecha ISO-8601"
}
```

Los cambios se escriben primero a un archivo temporal y luego se reemplaza `appointments.json`. La comprobación de solapamientos y la escritura se ejecutan en una sección serializada: antes de guardar se releen las reservas y se vuelve a verificar el elevador/franja.

## 5. API

Todas las rutas requieren sesión de cliente, salvo que se indique otra cosa. Las rutas de escritura aceptan JSON; los datos de disponibilidad se consultan mediante query parameters.

### `GET /api/appointments/services`

Devuelve identificador, nombre, descripción, disponibilidad, precio vigente en ARS y duración configurada (marcada como provisional solo si corresponde). La respuesta de disponibilidad también devuelve el total calculado para el turno.

### `GET /api/appointments/availability?serviceId=...&date=YYYY-MM-DD`

Devuelve los inicios posibles para el servicio/fecha, sin exponer ni permitir elegir elevador desde el cliente. Solo incluye horarios donde la capacidad disponible entre elevadores habilitados alcanza para las reservas superpuestas y el límite diario no se agotó. No ofrece horarios fuera de la jornada, fechas pasadas, días no laborables ni servicios inactivos o bloqueados por insumos. Cada opción incluye `startTime` y `endTime`.

### `POST /api/appointments`

**Entrada:** `serviceId`, `vehicle.make`, `vehicle.model`, `date`, `startTime`. El `liftId` enviado por el cliente se ignora; solo el jefe puede asignarlo.

El servidor comprueba sesión, formato, servicio activo, insumos, jornada, fecha futura, intervalo válido y capacidad libre considerando elevadores habilitados y reservas activas. El `userId`, nombre del servicio, duración, fin, costo, estado y elevador sin asignar se establecen en el servidor.

- `201 Created`: turno registrado como `solicitado` con comprobante digital.
- `400 Bad Request`: campos/formato inválidos.
- `401 Unauthorized`: falta sesión.
- `409 Conflict`: la capacidad de la franja dejó de estar disponible.
- `422 Unprocessable Entity`: servicio/fecha/horario no reservable.
- `500 Internal Server Error`: error genérico de persistencia.

El precio del turno se calcula como `quoteBase + estimatedPrice`; la base configurada es cero y los importes acordados se guardan en ARS por servicio. Se marca `quoteStatus: "definitiva"`. Los turnos existentes se actualizaron para reflejar estos precios.

### `GET /api/appointments/mine`

Devuelve únicamente los turnos del cliente autenticado, ordenados por fecha y hora. Incluye `reviewedAt`, `completedAt` y estado para que el panel del cliente muestre el resultado y el tiempo transcurrido desde la aprobación, rechazo o finalización.

### `GET /api/appointments/management`

Disponible únicamente para `jefe-taller`. Devuelve la agenda completa ordenada cronológicamente, con número de comprobante, nombre, email y teléfono del cliente, horario, vehículo, servicio, estado y elevadores asignables por turno. Incluye los cuatro elevadores con estado `disponible`, `ocupado` (hay un turno asignado en curso hoy) o `deshabilitado`, además de los cuatro mecánicos con su elevador actual.

### `GET /api/appointments/mechanic`

Disponible únicamente para `mecanico`. Devuelve el nombre del mecánico y el elevador asociado a su cuenta, junto con los turnos aprobados vigentes o futuros asignados a ese elevador. Cada trabajo muestra servicio, modelo del auto, número de comprobante, nombre del cliente, fecha y horario. No devuelve correo del cliente ni permite modificar turnos.

### `PATCH /api/appointments/management/:appointmentId/lift`

Disponible únicamente para `jefe-taller`. Acepta `{ "liftId": "elevador-1" }` y asigna o cambia el elevador de un turno activo. El servidor valida que exista, esté habilitado y no se superponga con otro turno asignado.

### `PATCH /api/appointments/management/lifts/:liftId`

Disponible únicamente para `jefe-taller`. Acepta `{ "enabled": false }` para deshabilitar o `true` para habilitar un elevador. No permite deshabilitarlo si tiene turnos activos futuros o en curso; primero deben reasignarse.

### `PATCH /api/appointments/management/mechanics/:mechanicId/lift`

Disponible únicamente para `jefe-taller`. Acepta `{ "liftId": "elevador-1" }`. La cuenta del mecánico queda vinculada a ese elevador y su panel muestra los trabajos aprobados asignados allí. Si el destino ya tiene otro mecánico, el servidor intercambia las asignaciones para mantener un mecánico por elevador. Solo se aceptan elevadores habilitados.

### `PATCH /api/appointments/management/:appointmentId`

Disponible únicamente para `jefe-taller`. Acepta `status: "confirmado"`, `status: "rechazado"` o `status: "finalizado"`. Confirmar o rechazar solo está permitido para solicitudes `solicitado`; exige elevador asignado antes de confirmar y guarda el usuario jefe y la fecha de revisión. Finalizar solo está permitido para turnos `confirmado` y registra `completedBy` y `completedAt`.

## 6. Integración de interfaz

- Los servicios se cargan desde el endpoint; la UI no mantiene una lista divergente.
- Al seleccionar servicio y fecha, se consulta disponibilidad actualizada y se ofrecen horarios; el elevador lo asigna el jefe.
- Al consultar disponibilidad para el servicio y fecha elegidos, el resumen muestra el precio vigente en ARS, sin etiqueta de provisional.
- Al enviar, se muestra comprobante con identificador, servicio, vehículo, horario, aviso de que el jefe asignará el elevador, estado y precio definitivo.
- Si otra solicitud tomó el espacio, se informa el conflicto y se vuelve a consultar la disponibilidad.
- `pages/panel-usuario.html` consume `GET /api/appointments/mine`, muestra el estado y calcula en el navegador el tiempo transcurrido desde `reviewedAt` para aprobaciones y rechazos; actualiza los datos cada 30 segundos y el contador cada segundo.

## 7. Criterios de aceptación

1. Un cliente sin sesión no puede listar servicios privados, consultar disponibilidad ni registrar turnos.
2. Un cliente autenticado puede consultar servicios habilitados y disponibilidad por fecha.
3. Servicios con falta de insumos o deshabilitados no pueden reservarse.
4. Una reserva guarda duración, cliente, estado y precio derivados por el servidor, con elevador inicialmente sin asignar.
5. Dos solicitudes simultáneas no pueden exceder la capacidad libre de elevadores habilitados ni el máximo diario.
6. Una solicitud con fecha/hora inválida, pasada o fuera de jornada se rechaza.
7. El costo nunca es aceptado desde el navegador; se calcula con configuración del servidor o se presenta como pendiente.
8. El comprobante muestra el horario registrado y el estado `solicitado`.
9. Los turnos de un cliente no exponen los de otros clientes.
10. El jefe puede listar todas las solicitudes y aprobar o rechazar las que aún estén pendientes.
11. El jefe ve los cuatro elevadores y su estado; puede habilitarlos o deshabilitarlos, salvo que tengan turnos activos futuros/en curso.
12. El jefe asigna un elevador libre a cada solicitud antes de aprobarla; el servidor evita solapamientos.
13. El jefe puede cambiar la asignación de elevador de cada mecánico desde el panel; si el elevador destino ya tiene un mecánico, intercambia ambos para conservar una asignación por elevador.
14. Los mecánicos solo ven trabajos aprobados asignados al elevador vinculado a su cuenta, con servicio, modelo, comprobante, nombre del cliente, fecha y horario; no acceden a la agenda completa ni modifican turnos.
15. Los clientes y mecánicos no pueden ejecutar acciones de aprobación o asignación de elevadores.
16. El cliente solo ve sus propias solicitudes y, cuando el jefe las revisa, ve si fueron aprobadas o rechazadas y hace cuántas horas, minutos y segundos ocurrió.

## 8. Pendientes para uso real

- Añadir feriados/cierres excepcionales.
- Definir si los precios variarán por vehículo.
- Implementar la cancelación del cliente hasta 2 horas antes y liberar la capacidad correspondiente.
- Definir cómo se notificará la aprobación/rechazo y qué ocurre con solicitudes pendientes o ausencias.
- Alta pública de mecánicos y administración dinámica de cuentas/permisos.
- Confirmar si la disponibilidad de mecánicos también limita las reservas.
- Para varias instancias o uso concurrente fuera del taller, migrar la escritura a una base de datos con transacciones.
