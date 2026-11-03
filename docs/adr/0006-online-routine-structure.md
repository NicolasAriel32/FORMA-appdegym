# ADR 0006: edición estructural online de rutinas

## Estado

Aceptada para el incremento de rutinas.

## Decisión

- Las rutinas pertenecen a un único propietario interno y se consultan con autenticación.
- Crear y editar la estructura requiere conexión; no se agrega una rutina estructural al outbox de entrenamientos personales.
- Los ejercicios de una rutina deben provenir del catálogo oficial vigente.
- La estructura usa revisión monotónica y filas con estado `active`/`removed`; no se elimina automáticamente una rutina ni un ejercicio.
- Supabase aplica RLS tanto a la rutina como a sus ejercicios mediante la relación con `app_users.auth_user_id`.
- Aceptar un programa futuro de entrenador no está modelado como consentimiento de sesiones personales.

## Consecuencia

El editor puede ser simple y consistente online, mientras que el registro de series sigue disponible offline. La persistencia completa en PostgreSQL y el reemplazo transaccional de posiciones quedan en el repositorio persistente del API, no en el cliente.
