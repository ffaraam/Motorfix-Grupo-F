# MotorFix — estado actual del proyecto

**Versión:** 1.0  
**Estado:** resumen de alcance implementado y trabajo pendiente  
**Documentos relacionados:** `motorfix-requisitos-sdd.md`, `specs/backend-autenticacion.md`, `specs/backend-turnos.md`

Este documento resume la aplicación y ayuda a distinguir funcionalidades disponibles de decisiones o módulos que todavía faltan. Las duraciones, cotizaciones y algunas reglas operativas siguen siendo provisionales cuando así se indica.

## 1. Qué está implementado

### Experiencia del sitio

- Portada pública de MotorFix con explicación del taller, servicios, foto principal y acceso a clientes.
- Fuente Martian Mono de Google Fonts y favicon en las páginas HTML existentes.
- Páginas adaptables para acceso, registro, solicitud de turno, panel del cliente, panel del jefe y agenda del mecánico.

### Identidad y permisos

- Registro público de clientes con nombre, correo, teléfono y contraseña.
- Inicio/cierre de sesión con sesiones de servidor y contraseñas con hash bcrypt.
- Cuenta preconfigurada para el jefe en `config/manager-account.json`; el archivo contiene el hash, no la clave en claro.
- Cuatro cuentas preconfiguradas en `config/mechanic-accounts.json`, una vinculada a cada elevador; el archivo conserva hashes, no contraseñas en claro.
- Roles `cliente`, `jefe-taller` y `mecanico`; el registro público no permite elegir un rol.
- Páginas y rutas de API protegidas según rol.

### Solicitud y gestión de turnos

- Catálogo dinámico de siete servicios cargado por API.
- Consulta de horarios disponibles según la capacidad de los elevadores habilitados; el cliente no elige elevador.
- Registro de solicitudes con cliente, vehículo, servicio, horario, estado y comprobante. El jefe asigna el elevador desde su panel.
- Revalidación de horario y capacidad de elevadores habilitados al guardar; máximo de cuatro solicitudes activas por día.
- Panel del jefe con filtros, datos de cliente/vehículo/servicio/horario y número de comprobante. Muestra los cuatro elevadores como disponibles, ocupados (turnos en curso hoy) o deshabilitados; permite habilitarlos/deshabilitarlos, asignarlos a turnos, vincular cada mecánico a un elevador y aprobar/rechazar solicitudes pendientes.
- Panel del cliente con sus solicitudes y sus estados. Para turnos aprobados o rechazados, muestra horas, minutos y segundos transcurridos desde la revisión; refresca datos cada 30 segundos y el contador cada segundo.
- Panel de mecánico de solo lectura: muestra trabajos aprobados vigentes o futuros de su elevador, con servicio, modelo del auto, comprobante, nombre del cliente y horario.
- En el formulario se informa que la cancelación puede solicitarse hasta dos horas antes; por ahora se coordina directamente con MotorFix, porque todavía no existe la acción para cancelar desde la cuenta.

### Persistencia

- Usuarios: `data/users.json`.
- Sesiones: `data/sessions/`.
- Catálogo, horario y reservas: `data/services.json`, `data/workshop.json` y `data/appointments.json`.
- Las plantillas iniciales están en `config/`. Al arrancar, se copian a `data/` solo si los archivos de datos todavía no existen.

## 2. Reglas de negocio acordadas

- Atención de lunes a sábado, de 08:00 a 19:00, zona `America/Argentina/Buenos_Aires`.
- Cuatro elevadores y un máximo de cuatro turnos por día. El jefe asigna el elevador; solicitudes activas sin asignar consumen capacidad horaria disponible.
- Servicios: cambio de aceite y filtros; frenos; alineación y balanceo; suspensión y dirección; sistema eléctrico; diagnóstico OBD2; distribución y correas.
- Precios fijos por servicio, definidos como definitivos: aceite y filtros **$160.000**; frenos **$225.000**; alineación y balanceo **$72.500**; suspensión y dirección **$450.000**; sistema eléctrico **$110.000**; diagnóstico OBD2 **$40.000**; distribución y correas **$450.000 ARS**.
- Duraciones definidas por servicio: aceite y filtros 60 min; frenos 120; alineación y balanceo 60; suspensión y dirección 240; sistema eléctrico 90; diagnóstico OBD2 30; distribución y correas 300.
- Toda solicitud queda `solicitado` hasta que el jefe la aprueba (`confirmado`) o rechaza (`rechazado`). Solicitudes pendientes y aprobadas ocupan capacidad; las rechazadas la liberan.
- El cliente puede cancelar hasta dos horas antes. Mientras no esté implementada la cancelación en la aplicación, debe coordinarla directamente con MotorFix.
- Solo el jefe puede revisar solicitudes; los mecánicos consultan en modo de solo lectura los trabajos aprobados de su elevador.

## 3. Qué falta implementar

### Operación del negocio

- Controles en el panel del jefe para editar horarios, servicios, duración y disponibilidad de insumos; por ahora esos ajustes se realizan en archivos locales de datos. La habilitación de elevadores y su asignación a turnos sí se administra desde el panel.
- Cancelación de turnos desde el panel del cliente, con validación de la anticipación mínima de dos horas y liberación de capacidad.
- Pruebas automatizadas para los flujos de autenticación, solicitud, revisión y cancelación de turnos.
- Alta pública de mecánicos y administración dinámica de cuentas/permisos.
- Flujo de estados del vehículo (`En Taller`, `En Reparación`, `Esperando Repuesto`, `Listo para Retirar`) y alertas por demoras.
- Reporte diario de vehículos ingresados.
- Pantalla pública que muestre exclusivamente modelo y estado del vehículo.

### Definiciones y calidad

- Validar la capacidad y el flujo de asignación de elevadores con la operación real; por ahora se ofrecen inicios horarios cada 60 minutos y se verifica la disponibilidad según la duración del trabajo.
- Definir si los precios fijos actuales variarán según el vehículo.
- Feriados, cierres excepcionales y capacidad ante solicitudes pendientes que no se revisen.
- Volumen concurrente del horario pico, objetivo de respuesta y política de reintentos/fallos.
- Copias de seguridad y recuperación de JSON; migración a base de datos si se requieren varias instancias.
- Compatibilidad y accesibilidad validadas formalmente en navegadores y dispositivos; aún no hay pruebas automatizadas del flujo completo.
- Integración con un servicio REST externo; las rutas REST locales de MotorFix sí están implementadas.

## 4. Configuración y ejecución local

```text
npm install
npm start
```

Abrir `http://localhost:3000`. El servidor crea los archivos faltantes en `data/` a partir de las plantillas `config/`. Para modificar valores en una instalación que ya arrancó, editar `data/services.json` o `data/workshop.json`; los cambios en `config/` no reemplazan archivos existentes.

## 5. Documentos fuente

- `motorfix-requisitos-sdd.md`: requisitos funcionales/no funcionales, decisiones de negocio y trazabilidad con el caso de estudio.
- `specs/backend-autenticacion.md`: API de usuarios, sesiones, roles y cuenta inicial del jefe.
- `specs/accesos-prueba.md`: correos, contraseñas iniciales y roles para el jefe, mecánicos y clientes de prueba.
- `specs/backend-turnos.md`: API de servicios, disponibilidad, solicitudes, revisión del jefe y límites operativos del backend.
