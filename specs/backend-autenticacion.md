# Especificación: backend de registro e inicio de sesión

**Proyecto:** MotorFix  
**Versión:** 1.0  
**Estado:** Implementado en la primera versión local  
**Alcance:** alta de cuentas de clientes, cuenta inicial del jefe de taller, cuatro cuentas preconfiguradas de mecánicos e inicio/cierre de sesión en un servidor local Node.js.

Las credenciales de acceso de prueba están enumeradas en `specs/accesos-prueba.md`.

## 1. Objetivo

Implementar un backend sencillo para que los clientes creen una cuenta y luego ingresen a MotorFix. El servidor será la autoridad para validar credenciales y mantener la sesión. El navegador no guardará contraseñas ni decidirá por sí solo si un usuario está autenticado.

El registro público solo crea cuentas de clientes. La cuenta del jefe y las cuatro cuentas de mecánicos se provisionan localmente; cada mecánico queda vinculado a un elevador. Los roles protegen cada panel y ruta. No incluye alta pública ni administración de cuentas de mecánico, recuperación de contraseña, verificación de correo ni cambios de contraseña.

## 2. Tecnologías y estructura propuesta

- **Node.js** para ejecutar el servidor local.
- **Express** para servir la aplicación y exponer rutas HTTP.
- **JSON local** como almacenamiento inicial de cuentas, en coherencia con RNF-06 y RNF-07.
- **bcryptjs** para almacenar hashes de contraseñas, nunca contraseñas en texto plano. Las claves aceptan al menos 8 caracteres y hasta 72 bytes, límite de bcrypt.
- **Sesión de servidor persistida en archivos** mediante `session-file-store`, con cookie `HttpOnly`; el navegador solo conserva el identificador de sesión.
- Middleware de Express para analizar formularios, validar entradas, administrar sesión y restringir rutas.

Estructura inicial sugerida:

```text
server.js
src/
  routes/auth.js
  middleware/require-auth.js
  services/user-store.js
  validation/auth.js
data/
  users.json
  sessions/
```

El directorio `data` se mantendrá fuera del contenido estático público. Las páginas HTML podrán servirse desde la raíz del proyecto o desde una carpeta pública configurada por Express.

## 3. Modelo de usuario

Cada registro tendrá, como mínimo:

```json
{
  "id": "identificador-unico",
  "nombre": "Nombre y apellido",
  "email": "cliente@example.com",
  "telefono": "dato ingresado por el cliente",
  "passwordHash": "hash bcrypt",
  "role": "cliente",
  "createdAt": "fecha ISO-8601"
}
```

Las cuentas de mecánico añaden `mechanicKey` (identificador estable de la cuenta) y `liftId`, que identifica el elevador asignado. Las cuatro cuentas iniciales están definidas en `config/mechanic-accounts.json`, una por elevador; el jefe puede cambiar la asignación desde su panel. Solo se guarda el hash bcrypt de cada contraseña. La provisión inicial conserva la asignación guardada en datos y no la restablece en cada inicio.

- `id` será generado por el servidor.
- `email` se normalizará quitando espacios externos y se comparará sin distinguir mayúsculas/minúsculas. El correo es el identificador único de acceso.
- `passwordHash` se generará en el servidor y nunca se incluirá en respuestas.
- `role` se establecerá en `cliente` por el servidor durante el registro; no se aceptará desde el formulario. Los roles internos provisionados son `jefe-taller` y `mecanico`.
- El servidor validará los tipos, campos obligatorios y longitudes razonables antes de guardar.

## 4. Persistencia y manejo de fallos

- La lista de usuarios se guardará en `data/users.json`.
- El servidor creará el archivo con una lista vacía si aún no existe.
- Cada escritura se realizará de forma segura: escribir el contenido completo en un archivo temporal y luego reemplazar el archivo principal, para reducir el riesgo de dejar JSON truncado ante una interrupción.
- Si la lectura o escritura falla, se registrará el error en el servidor y se responderá con un error genérico; no se devolverán rutas internas ni detalles del sistema de archivos.
- Antes de una modificación se volverá a leer el archivo para evitar basarse en una copia antigua. Para la escala inicial de uso local se asume una sola instancia del servidor. Si el uso simultáneo crece, se deberá migrar a una base de datos con restricciones únicas y transacciones.

## 5. API de autenticación

Las rutas aceptarán y responderán JSON. Los formularios HTML podrán enviar sus datos al backend mediante `fetch`.

### `POST /api/auth/register`

**Entrada:** `nombre`, `email`, `telefono`, `password`.

**Comportamiento:** validar los datos, normalizar el email, comprobar que no exista una cuenta con el mismo email, calcular el hash y guardar el usuario. Al finalizar, iniciar una sesión de cliente.

**Respuestas esperadas:**

- `201 Created`: cuenta creada; devuelve datos públicos (`id`, `nombre`, `email`, `role`), nunca el hash.
- `400 Bad Request`: campos inválidos o faltantes.
- `409 Conflict`: email ya registrado.
- `500 Internal Server Error`: fallo inesperado de persistencia u operación, con mensaje genérico.

### `POST /api/auth/login`

**Entrada:** `email` y `password`.

**Comportamiento:** buscar una cuenta por email normalizado, comparar la contraseña con bcrypt y, si coincide, crear/rotar la sesión. Ante credenciales incorrectas se devolverá el mismo mensaje genérico para email inexistente y contraseña incorrecta.

**Respuestas esperadas:**

- `200 OK`: sesión iniciada; devuelve datos públicos del usuario.
- `400 Bad Request`: faltan campos requeridos.
- `401 Unauthorized`: credenciales inválidas.
- `500 Internal Server Error`: error inesperado genérico.

### `GET /api/auth/me`

Devuelve los datos públicos del usuario asociado a la sesión actual (`200 OK`) o `401 Unauthorized` si no existe una sesión válida.

### `POST /api/auth/logout`

Invalida la sesión actual y limpia la cookie. Devuelve `204 No Content` al completarse.

## 6. Sesiones y controles básicos

- La cookie de sesión será `HttpOnly`, `SameSite=Lax` y `Secure` cuando el sitio se ejecute bajo HTTPS. En desarrollo local HTTP, `Secure` se desactivará mediante configuración del entorno.
- La clave secreta de sesión vendrá de una variable de entorno y no se guardará en el repositorio. El servidor fallará al arrancar si falta en configuración de producción.
- Las sesiones se guardan en archivos locales bajo `data/sessions/` en todos los entornos de esta versión.
- Se limitará el tamaño de las solicitudes y se validará el tipo de contenido.
- Se añadirán límites básicos de intentos de inicio de sesión para dificultar intentos repetidos de adivinar contraseñas.
- Los errores de autenticación no revelarán si una cuenta existe.
- El middleware valida sesión y rol para los paneles y endpoints privados.
- `/pages/pagina3.html` y `/pages/panel-usuario.html` requieren un cliente autenticado; `/pages/panel-jefe.html` requiere el rol `jefe-taller`.
- `/pages/panel-mecanico.html` y `GET /api/appointments/mechanic` requieren el rol `mecanico`.
- `PATCH /api/appointments/management/mechanics/:mechanicId/lift` requiere rol `jefe-taller`; permite reasignar mecánicos a elevadores habilitados y cambia de forma recíproca la asignación si el elevador ya tiene otro mecánico.
- Las sesiones duran 8 horas y se guardan bajo `data/sessions/`; la cookie solo contiene el identificador de sesión.

## 7. Integración con las páginas actuales

- `pages/registro.html`: envía el formulario a `POST /api/auth/register`, muestra errores y, ante éxito, lleva a `pages/panel-usuario.html`.
- `pages/pagina1.html`: envía correo y contraseña a `POST /api/auth/login`; el servidor lleva clientes a `panel-usuario.html` y al jefe a `panel-jefe.html`.
- Los paneles consultan `GET /api/auth/me` y llaman a `POST /api/auth/logout` al cerrar sesión.
- Al implementar la integración se reemplazarán las acciones actuales de formulario que solo navegan entre páginas; no se enviarán credenciales en parámetros de URL.

## 8. Criterios de aceptación

1. Un cliente puede crear una cuenta con datos válidos y se persiste tras reiniciar el servidor.
2. El archivo persistido contiene un hash de contraseña y nunca la contraseña original.
3. El registro rechaza campos inválidos y emails duplicados sin sobrescribir cuentas existentes.
4. Un cliente puede iniciar sesión con su email y contraseña correcta.
5. Una contraseña incorrecta o identificador desconocido devuelve un error genérico y no crea sesión.
6. `/api/auth/me` devuelve el cliente autenticado y rechaza solicitudes sin sesión.
7. El cierre de sesión invalida la sesión y `/api/auth/me` vuelve a responder `401`.
8. Las respuestas nunca incluyen `passwordHash`, la clave de sesión ni secretos del servidor.
9. Los formularios de registro e inicio de sesión muestran errores de forma comprensible y no ponen credenciales en la URL.

## 9. Supuestos y decisiones pendientes

- El alta pública solo crea usuarios con rol `cliente`. La cuenta `admin@gmail.com` se provisiona con rol `jefe-taller`; `motorfix1@gmail.com`, `motorfix2@gmail.com`, `motorfix3@gmail.com` y `motorfix4@gmail.com` se provisionan con rol `mecanico` y se vinculan respectivamente a `elevador-1` a `elevador-4`. Los hashes se guardan en los archivos de configuración de cuentas.
- Se solicita email, pero no se verifica su propiedad en esta primera versión. Si se requiere verificación o recuperación de contraseña, hará falta definir el mecanismo de envío de correo, que queda fuera del alcance actual.
- Se asume una única instancia Node.js local y un volumen pequeño de usuarios. JSON no ofrece bloqueos/operaciones atómicas multi-proceso; la concurrencia de escrituras y múltiples instancias requieren una base de datos.
- Antes de publicar el servicio fuera de la red local, se deben configurar HTTPS, secreto robusto, almacén persistente de sesiones, límites de intentos y una política de copias de seguridad.
- La sesión dura 8 horas; cambiar ese plazo requiere ajustar configuración/código.
- La longitud de contraseña de cliente es de al menos 8 caracteres y un máximo de 72 bytes por bcrypt.
- Confirmar si el taller necesita recolectar teléfono y si también requiere DNI u otros datos. No se agregan datos personales adicionales sin necesidad validada.

## 10. Fuera de alcance de esta especificación

- Persistir contraseñas o sesiones en `localStorage`.
- OAuth o inicio de sesión con proveedores externos.
- Verificación de email y recuperación de contraseña.
- Alta pública de mecánicos y administración dinámica de sus permisos.
- Recuperación/verificación de cuenta y cambio de contraseña.
- Publicación en un proveedor de hosting o apertura del servidor a Internet.

## 11. Relación con requisitos existentes

- **RF-01:** autenticación de clientes, jefe y cuatro mecánicos preconfigurados; el alta pública de mecánicos no está implementada.
- **RNF-06:** persistencia local en archivos JSON; esta etapa agrega `data/users.json`.
- **RNF-07:** servidor local en Node.js.

Las rutas privadas aplican roles `cliente`, `jefe-taller` y `mecanico`. Los mecánicos usan una vista de solo lectura asociada al elevador de su cuenta.

## 12. Ejecución local

1. Instalar Node.js 20 o superior.
2. Ejecutar `npm install`.
3. (Opcional en desarrollo) establecer `SESSION_SECRET` como variable de entorno; para uso local de prueba el servidor avisa y usa una clave de desarrollo.
4. Ejecutar `npm start` y abrir `http://localhost:3000`.

El archivo `data/users.json` y la carpeta `data/sessions/` se crean al iniciar el servidor y no se publican como archivos estáticos.

La cuenta inicial del jefe de taller es `admin@gmail.com`. Su clave predeterminada es la acordada por el negocio y el archivo de configuración conserva únicamente el hash. El inicio de sesión redirige a esa cuenta al panel privado del taller. El registro público no permite crear otro usuario con ese correo.

Las cuentas iniciales de mecánicos se redirigen a `panel-mecanico.html`; las contraseñas predeterminadas se entregan al jefe del taller fuera de los archivos versionados. El archivo de configuración conserva solo los hashes.
