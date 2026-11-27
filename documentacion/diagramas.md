# Diagramas de MotorFix

Estos diagramas describen el funcionamiento implementado actualmente. Se pueden visualizar en GitHub o en un editor compatible con Mermaid.

## 1. Arquitectura actual

```mermaid
flowchart LR
    Browser[ navegador: HTML, CSS y JavaScript ]
    subgraph App[Aplicación MotorFix en Node.js]
        Express[Express: server.js]
        Auth[API de autenticación\n/api/auth]
        Appointments[API de turnos\n/api/appointments]
        Middleware[Sesión y permisos por rol]
        Services[Servicios y reglas de negocio\nsrc/services]
        Files[(Archivos JSON en data/)]
        Config[(Configuración inicial\nconfig/)]
        Static[Archivos estáticos\npages/, js/, css/, images/]
        Express --> Auth
        Express --> Appointments
        Express --> Static
        Auth --> Middleware
        Appointments --> Middleware
        Auth --> Services
        Appointments --> Services
        Services --> Files
        Services --> Config
    end
    Browser <-->|HTTP y JSON| Express
```

## 2. Roles y acciones principales

```mermaid
flowchart TB
    Cliente[Cliente]
    Jefe[Jefe de taller]
    Mecanico[Mecánico]

    Cliente --> C1[Consultar servicios y horarios]
    Cliente --> C2[Solicitar turno]
    Cliente --> C3[Consultar sus turnos y estados]
    Cliente --> C4[Cancelar su turno si respeta el plazo]

    Jefe --> J1[Revisar, aprobar o rechazar solicitudes]
    Jefe --> J2[Asignar elevadores y mecánicos]
    Jefe --> J3[Actualizar estado del vehículo]
    Jefe --> J4[Editar servicios y horarios del taller]
    Jefe --> J5[Consultar tablero y reporte diario]

    Mecanico --> M1[Consultar trabajos asignados a su elevador]
    M1 -. "consulta; no cambia estados" .-> J3
    C3 -. "solo datos propios" .-> J3
```

## 3. Flujo del caso de uso principal: solicitud y reparación

```mermaid
sequenceDiagram
    actor Cliente
    participant Frontend as Pantallas web
    participant API as API Express
    participant Reglas as Reglas del taller
    participant Datos as Archivos de datos
    actor Jefe as Jefe de taller
    actor Mecanico as Mecánico

    Cliente->>Frontend: Elige servicio, fecha y horario
    Frontend->>API: GET servicios y disponibilidad
    API->>Reglas: Verifica catálogo, horario y capacidad
    Reglas->>Datos: Lee servicios, taller y turnos
    Datos-->>API: Datos actuales
    API-->>Frontend: Servicios y horarios libres
    Cliente->>Frontend: Confirma vehículo y turno
    Frontend->>API: POST /api/appointments
    API->>Reglas: Valida sesión, datos y reglas de negocio
    Reglas->>Datos: Guarda turno como solicitado
    API-->>Frontend: Comprobante de solicitud
    Jefe->>Frontend: Revisa la agenda
    Frontend->>API: GET /api/appointments/management
    API-->>Frontend: Solicitudes, agenda y tablero
    Jefe->>Frontend: Aprueba/rechaza y asigna elevador
    Frontend->>API: PATCH de estado/asignación
    API->>Reglas: Comprueba rol y transición permitida
    Reglas->>Datos: Actualiza el turno
    Mecanico->>Frontend: Consulta trabajos asignados
    Frontend->>API: GET /api/appointments/mechanic
    API-->>Frontend: Trabajos del elevador asociado
    Jefe->>Frontend: Actualiza estado del vehículo
    Frontend->>API: PATCH /management/:id/vehicle-status
    API->>Reglas: Comprueba que sea jefe de taller
    Reglas->>Datos: Guarda el estado del vehículo
    Cliente->>Frontend: Consulta sus turnos
    Frontend->>API: GET /api/appointments/mine
    API-->>Frontend: Estado y demora de sus turnos
```

## 4. Estados de un turno y del vehículo

```mermaid
stateDiagram-v2
    state "Turno solicitado" as solicitado
    state "Turno confirmado" as confirmado
    state "Turno rechazado" as rechazado
    state "Turno cancelado" as cancelado
    state "Turno finalizado" as finalizado

    [*] --> solicitado: cliente solicita turno
    solicitado --> confirmado: jefe aprueba
    solicitado --> rechazado: jefe rechaza
    solicitado --> cancelado: cliente cancela dentro del plazo
    confirmado --> cancelado: cliente cancela al menos 2 h antes
    confirmado --> finalizado: jefe marca Listo para Retirar
    rechazado --> [*]
    cancelado --> [*]
    finalizado --> [*]

    note right of confirmado
      El jefe administra el estado del vehículo:
      En Taller → En Reparación → Esperando Repuesto
      → Listo para Retirar.
      Se informa demora al superar la duración estimada
      por 15 minutos o más.
    end note
```

> El estado del turno y el estado del vehículo son distintos; solo el jefe de taller puede modificarlos.
