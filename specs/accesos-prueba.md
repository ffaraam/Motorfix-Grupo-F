# MotorFix — cuentas de acceso y prueba

**Versión:** 1.0  
**Uso:** desarrollo local y pruebas funcionales  
**Última actualización:** 25/11/2026

Este documento reúne los accesos preconfigurados. Las contraseñas se muestran aquí para facilitar las pruebas; en los archivos de configuración y datos se guardan únicamente hashes bcrypt.

## Jefe de taller

| Correo | Contraseña | Rol |
|---|---|---|
| `admin@gmail.com` | `motorfix1714` | Jefe de taller: administra solicitudes, elevadores y asignación de mecánicos. |

La cuenta se provisiona desde `config/manager-account.json`.

## Mecánicos

| Elevador inicial | Correo | Contraseña | Rol |
|---|---|---|---|
| Elevador 1 | `motorfix1@gmail.com` | `motorfix1714` | Mecánico 1 |
| Elevador 2 | `motorfix2@gmail.com` | `motorfix1417` | Mecánico 2 |
| Elevador 3 | `motorfix3@gmail.com` | `motorfix1174` | Mecánico 3 |
| Elevador 4 | `motorfix4@gmail.com` | `motorfix1147` | Mecánico 4 |

Los mecánicos ingresan a `panel-mecanico.html` y consultan trabajos aprobados asignados a su elevador. El jefe puede cambiar la asignación desde el panel; los accesos conservan su rol y su contraseña. Las cuentas se provisionan desde `config/mechanic-accounts.json`.

## Clientes de prueba

| Nombre | Correo | Contraseña | Rol |
|---|---|---|---|
| Cliente de prueba 1 | `cliente1@motorfix.local` | `MotorFixCliente!01` | Cliente |
| Cliente de prueba 2 | `cliente2@motorfix.local` | `MotorFixCliente!02` | Cliente |

Estas cuentas se crean automáticamente en entornos locales cuando `NODE_ENV` no es `production`. Se definen en `config/test-client-accounts.json` y no se provisionan en producción. Se pueden usar para solicitar turnos y consultar el panel de cliente.

## Cuenta de prueba ya registrada

En los datos locales actuales también figura `frankcroquetas@gmail.com` (nombre de cuenta: “franco de andrea”). La contraseña original no se conserva en texto legible y no puede recuperarse del hash; usar las cuentas de prueba anteriores si no se recuerda la contraseña elegida al registrarla.

## Acceso según el rol

- Jefe de taller: panel privado del taller.
- Mecánico: agenda de trabajos aprobados del elevador asignado.
- Cliente: solicitud de turnos y consulta de sus propias solicitudes.

El registro público crea únicamente cuentas de cliente. No usar las cuentas de prueba para información real.
