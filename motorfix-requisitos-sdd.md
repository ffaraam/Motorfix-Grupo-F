# MotorFix - Especificación de requisitos

**Versión:** 1.0  
**Estado:** Borrador con decisiones operativas del negocio validadas para la primera versión  
**Fuente:** Caso de estudio “Plataforma de Turnos MotorFix” (2 páginas)

## 1. Propósito

Definir una base verificable para desarrollar la plataforma web de MotorFix. El sistema centraliza la solicitud y administración de turnos, el seguimiento de vehículos y la ocupación de elevadores.

Este documento distingue los requisitos expresados en el caso de estudio de los detalles que todavía requieren validación con el taller.

## 2. Alcance

La plataforma contempla:

- Autenticación de conductores y personal del taller.
- Solicitud, consulta y cancelación de turnos.
- Consulta de disponibilidad de servicios, fechas y elevadores.
- Cálculo y presentación de costos estimados.
- Gestión de estados de vehículos.
- Tablero de ocupación y disponibilidad del taller.
- Reporte diario de vehículos ingresados.
- Integración con una API REST.
- Persistencia local de los datos de servicios y turnos.

### Fuera del alcance especificado

El caso no define pagos en línea, asignación automática de mecánicos, envío de notificaciones por correo o SMS, ni un plazo concreto de cancelación. No deben asumirse como parte de esta especificación sin validación.

## 3. Actores

| Actor | Tipo | Responsabilidades |
|---|---|---|
| Conductor/cliente | Principal para solicitar y consultar turnos | Solicitar turnos, consultar historial y turnos futuros, cancelar con anticipación. |
| Jefe de taller/administrador | Principal para la gestión del taller | Consultar agenda, cambiar estados, revisar ocupación, demanda y disponibilidad de mecánicos. |
| Mecánico | Usuario interno de consulta | Ver, en modo de solo lectura, el trabajo aprobado asignado a su elevador: servicio, modelo del auto, comprobante y nombre del cliente. |
| API REST de MotorFix | Secundario / sistema externo | Proveer datos de servicios y estado de turnos. |

## 4. Requisitos funcionales

### RF-01 - Autenticación

El sistema debe exigir credenciales a conductores y personal del taller antes de permitir el acceso a sus funcionalidades.

### RF-02 - Solicitud de turno

El sistema debe permitir al conductor iniciar una solicitud, seleccionar un servicio e ingresar la marca y el modelo del vehículo.

### RF-03 - Consulta de disponibilidad

El sistema debe consultar y mostrar fechas y horarios con capacidad disponible para el servicio seleccionado. El elevador lo asigna el jefe de taller.

### RF-04 - Estimación del costo

El sistema debe mostrar el precio fijo del servicio seleccionado antes de registrar el turno. Los precios acordados están expresados en pesos argentinos (ARS); por ahora no varían por vehículo.

### RF-05 - Confirmación de turno

Al confirmar una solicitud, el sistema debe registrar el turno y mostrar un comprobante digital con el horario de recepción.

### RF-06 - Historial del cliente

El sistema debe permitir al conductor consultar servicios anteriores, reparaciones pasadas y turnos futuros.

### RF-07 - Cancelación de turno

El sistema debe permitir al conductor cancelar un turno con anticipación.

**Decisión del negocio:** la cancelación se permitirá hasta 2 horas antes del horario del turno.

### RF-08 - Agenda del taller

El sistema debe permitir al jefe de taller consultar los turnos entrantes ordenados por horario de llegada.

### RF-09 - Estados del vehículo

El sistema debe permitir al personal autorizado actualizar el estado del vehículo y mostrar alertas visuales cuando haya demoras inesperadas. La vista del mecánico aún no permite actualizar estados.

### RF-10 - Tablero de control

El sistema debe ofrecer al jefe de taller un tablero que consolide la ocupación de elevadores, los servicios más demandados y los mecánicos disponibles.

### RF-11 - Reporte diario

El sistema debe generar un reporte diario de los vehículos ingresados.

### RF-12 - Pantalla pública

El sistema debe mostrar en la pantalla pública únicamente el modelo del vehículo y su estado.

### RF-13 - Integración con API REST

El sistema debe comunicarse con una API REST para obtener datos de servicios y el estado de los turnos.

## 5. Requisitos no funcionales

### RNF-01 - Tiempo de respuesta

La confirmación de un turno debe responder en un máximo de **2 segundos**.

### RNF-02 - Concurrencia

El servidor debe procesar solicitudes simultáneas, incluyendo el horario pico de las **08:00**, sin permitir reservas incompatibles para un mismo elevador.

**Pendiente:** acordar el volumen de solicitudes simultáneas esperado.

### RNF-03 - Compatibilidad

La aplicación web debe ser compatible con las versiones más recientes de Chrome, Safari y Firefox, en escritorio y dispositivos móviles.

### RNF-04 - Usabilidad de la interfaz del taller

La interfaz administrativa debe:

- Usar botones de al menos **80 × 80 píxeles**.
- Permitir gestos amplios de deslizamiento en lugar de depender de toques precisos.
- Usar colores de alto contraste para facilitar el uso con guantes y pantallas sucias.

### RNF-05 - Privacidad en pantalla pública

La pantalla pública no debe mostrar la patente ni el apellido del dueño del vehículo.

### RNF-06 - Persistencia e integridad

Los datos deben persistirse en archivos JSON ubicados en el servidor local y conservar la integridad de la agenda ante cortes de energía.

### RNF-07 - Plataforma tecnológica

La aplicación web debe centralizar la lógica de turnos y operar en un servidor local desarrollado en Node.js.

## 6. Reglas de dominio

### RD-01 - No superposición de elevadores

Un mismo elevador no puede tener turnos superpuestos.

### RD-02 - Duración del servicio

La duración de un servicio no puede ser negativa.

**Pendiente:** precisar si se admite una duración igual a cero.

### RD-03 - Revalidación al confirmar

Antes de guardar una reserva, el sistema debe verificar que el elevador y la franja horaria continúen disponibles.

### RD-04 - Estados de vehículo

Los estados contemplados por el caso son:

- En Taller
- En Reparación
- Esperando Repuesto
- Listo para Retirar

### RD-05 - Archivos de persistencia

La persistencia local contempla los archivos `services.json` y `appointments.json`.

## 7. Reglas de negocio

### RN-01 - Servicios ofrecidos

El cliente puede solicitar servicios habilitados por MotorFix. El taller definió:

1. **Cambio de aceite y filtros:** aceite de motor y filtros de aceite, aire, combustible y habitáculo.
2. **Frenos:** revisión y cambio de pastillas, discos, tambores, zapatas y líquido de frenos.
3. **Alineación y balanceo:** ajuste de dirección y equilibrado de ruedas para evitar desgaste irregular.
4. **Suspensión y dirección:** revisión y cambio de amortiguadores, rótulas, bujes, extremos y bieletas.
5. **Sistema eléctrico:** diagnóstico y cambio de batería, alternador, motor de arranque, luces y fusibles.
6. **Diagnóstico con scanner (OBD2):** lectura de códigos de falla, control de sensores y apagado de luces testigo.
7. **Distribución y correas:** cambio de kit de distribución, correa de accesorios, tensores y bomba de agua.

### RN-02 - Falta de insumos

Cuando falten insumos para un servicio, el sistema debe bloquear temporalmente nuevas solicitudes de ese servicio.

### RN-03 - Cálculo de cotización

El precio del turno se calcula según el servicio seleccionado y la cotización base configurada. En la versión actual la base es cero y cada servicio tiene un precio definido por el negocio.

### RN-04 - Cancelación con anticipación

El cliente puede cancelar un turno hasta 2 horas antes de su realización.

### RN-05 - Datos exhibidos públicamente

En la sala de espera se exhiben solamente el modelo del auto y su estado.

### RN-06 - Orden de la agenda

La agenda de turnos entrantes del jefe de taller se ordena por horario de llegada.

## 8. Criterios de aceptación base

Estos criterios traducen los requisitos anteriores en comprobaciones iniciales para el desarrollo. Los casos límite y los datos de prueba deben acordarse antes de cerrar la implementación.

1. Un usuario sin sesión iniciada no puede acceder a las funcionalidades protegidas.
2. Un conductor puede seleccionar un servicio y ver fechas y horarios con capacidad; no elige elevador.
3. Antes de enviar la solicitud, se presenta el precio fijo en ARS del servicio seleccionado.
4. Al confirmar con disponibilidad vigente, se registra el turno y se muestra el horario de recepción en un comprobante digital.
5. El jefe asigna un elevador habilitado a cada solicitud antes de aprobarla; el servidor impide superposiciones.
6. Un servicio bloqueado por falta de insumos no puede seleccionarse para una nueva solicitud.
7. La pantalla pública no presenta la patente ni el apellido del propietario.
8. El tiempo de respuesta de la confirmación no supera los 2 segundos bajo las condiciones de carga que se acuerden.
9. La agenda y los datos guardados siguen disponibles después de un corte de energía, conforme a la estrategia de persistencia que se defina.

## 9. Decisiones pendientes para completar la especificación

- ¿Qué volumen de solicitudes simultáneas debe soportarse en el horario pico?
- ¿Qué debe ver y poder hacer el usuario cuando la API REST no responde?
- ¿Qué política de reintento se aplica si falla la consulta o el guardado de un turno?
- ¿Se permite duración cero para un servicio?
- ¿Se modificarán los precios por vehículo o se mantendrán como precios fijos por servicio?
- ¿La disponibilidad depende de mecánicos además de los cuatro elevadores y el límite de cuatro turnos diarios?
- ¿Quién actualiza cada estado del vehículo durante la reparación?
- ¿Qué días feriados o cierres excepcionales se deben bloquear?
- ¿Cuánto tiempo puede quedar pendiente una solicitud de aprobación antes de liberar su espacio?

## 10. Trazabilidad de origen

Los requisitos funcionales, no funcionales y reglas marcados en este documento se derivan del caso de estudio MotorFix. Las preguntas de la sección 9 identifican ambigüedades que el caso no resuelve y que deben validarse con los interesados antes de tratarlas como comportamiento definitivo.

## 11. Decisiones operativas validadas por el negocio

- **Capacidad:** el taller cuenta con 4 elevadores y limita la atención a 4 turnos por día.
- **Horario:** lunes a sábado, de 08:00 a 19:00, en la zona horaria `America/Argentina/Buenos_Aires`.
- **Precios de servicios:** se acordaron importes fijos en ARS para los siete servicios; dejaron de ser valores provisionales. Aceite y filtros: $160.000; frenos: $225.000; alineación y balanceo: $72.500; suspensión y dirección: $450.000; sistema eléctrico: $110.000; diagnóstico OBD2: $40.000; distribución y correas: $450.000.
- **Duraciones:** aceite y filtros 60 minutos; frenos 120; alineación y balanceo 60; suspensión y dirección 240; sistema eléctrico 90; diagnóstico OBD2 30; distribución y correas 300. Son los valores definidos por el taller.
- **Aprobación:** el jefe de taller acepta o rechaza solicitudes desde su panel privado. El cliente consulta el resultado en su panel privado.
- **Cancelación:** el cliente puede cancelar hasta 2 horas antes del turno.
- **Permisos:** solo el jefe de taller puede revisar solicitudes, habilitar/deshabilitar elevadores y asignarlos a turnos. El panel permite consultar el estado de los cuatro elevadores y aprobar/rechazar solicitudes. Los mecánicos tienen cuentas preconfiguradas y una vista de solo lectura asociada a su elevador.

## 12. Datos operativos provisionales y pendientes

- Los precios indicados son fijos por servicio en esta versión; queda por decidir si variarán según el vehículo.
- Los cuatro elevadores y el límite de cuatro turnos diarios se aplican a la vez en la primera configuración.
- Faltan definir feriados, excepciones de horario, cuánto tiempo puede permanecer una solicitud esperando aprobación y qué ocurre con espacios retenidos por solicitudes rechazadas o vencidas.
- Sigue pendiente decidir si la disponibilidad depende de mecánicos además de elevadores, qué roles actualizan los estados del vehículo, el volumen pico esperado y las políticas de reintento ante fallos de la API.

## 13. Estado de implementación

| Área/requisito | Estado actual |
|---|---|
| Portada informativa | Implementada en `index.html`, con servicios, descripción de MotorFix, fotografía de taller y acceso a clientes. |
| Identidad visual | Implementada con Martian Mono de Google Fonts y favicon en las páginas HTML existentes. |
| Registro e inicio de sesión | Implementados para clientes; contraseñas con bcrypt, sesiones en archivos y rutas protegidas por rol. |
| Cuenta del jefe | Provisionada desde `config/manager-account.json`, con rol `jefe-taller` y contraseña guardada como hash. |
| Cuentas de mecánicos | Cuatro cuentas provisionadas desde `config/mechanic-accounts.json`, una vinculada a cada elevador. |
| Solicitud de turnos | Implementada: siete servicios, vehículo, disponibilidad según capacidad de elevadores habilitados, asignación posterior por el jefe, tope de cuatro turnos por día y comprobante. |
| Aprobación/rechazo | Implementados en el panel del jefe; solo solicitudes pendientes pueden revisarse. |
| Panel de cliente | Implementado para consultar sus solicitudes, el comprobante y el estado. Para aprobaciones/rechazos muestra el tiempo transcurrido desde `reviewedAt`. |
| Panel de mecánico | Implementado como vista de solo lectura para consultar los trabajos aprobados vigentes/futuros de su elevador. |
| Precios | Implementados como precios fijos por servicio en ARS; el formulario, los comprobantes y el panel del cliente los muestran como definitivos. |
| Cancelación | Regla de negocio definida (hasta dos horas antes), pero endpoint y acción en el panel de cliente pendientes. |
| Operación del taller | Parcial: el jefe ve/cambia el estado habilitado de los cuatro elevadores, los asigna a turnos, vincula mecánicos con elevadores y revisa solicitudes. Edición de servicios/insumos, demanda y disponibilidad de mecánicos pendientes. |
| Estados del vehículo y demora | Pendientes; los estados definidos por el caso no están conectados al trabajo del mecánico. |
| Reporte diario y pantalla pública | Pendientes. |
| Persistencia | Usuarios, sesiones, servicios, taller y solicitudes usan archivos locales; no hay base de datos multiinstancia. |

### Requisitos parcialmente cubiertos o pendientes

- **RF-01:** clientes, jefe y cuatro mecánicos autenticados; el alta pública de mecánicos no está implementada.
- **RF-02/RF-03:** formulario y consulta de servicios/disponibilidad implementados con duraciones definidas por el taller; las horas de inicio se ofrecen en intervalos de 60 minutos.
- **RF-04:** precios fijos por servicio disponibles; falta decidir si variarán por vehículo.
- **RF-05:** se registra una solicitud con comprobante y estado `solicitado`; la aceptación definitiva depende de la revisión del jefe.
- **RF-06:** panel de cliente muestra sus solicitudes; historial de reparaciones realizadas todavía no existe.
- **RF-07:** regla de cancelación definida; implementación pendiente.
- **RF-08/RF-10:** panel del jefe muestra solicitudes, datos del cliente, horario, vehículo, servicio, comprobante y acciones de aprobación/rechazo. Estado y habilitación de elevadores y asignación a turnos implementados; demanda y disponibilidad de mecánicos pendientes.
- **RF-09:** actualización de estados del vehículo y alertas pendientes; la vista del mecánico solo consulta trabajos asignados.
- **RF-11/RF-12:** reporte diario y pantalla pública pendientes.
- **RF-13:** API REST local implementada para autenticación y turnos; integración con un servicio REST externo no implementada.
- **RNF-01/RNF-02:** hay revalidación y serialización de solicitudes en una instancia local; tiempos y carga concurrente no medidos.
- **RNF-03/RNF-04:** interfaces adaptables y panel de jefe implementados; compatibilidad formal y evaluación de usabilidad con guantes/pantallas sucias pendientes.
- **RNF-05:** no existe aún pantalla pública para validar su privacidad.
- **RNF-06/RNF-07:** persistencia local JSON y servidor Node.js implementados; estrategia multiinstancia/recuperación y pruebas de cortes pendientes.
