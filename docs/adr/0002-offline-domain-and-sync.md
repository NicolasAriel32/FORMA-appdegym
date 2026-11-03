# ADR 0002 Dominio offline y sincronización

## Estado

Aceptada como base técnica de los incrementos offline. La implementación contra servicios reales y los límites cuantitativos siguen pendientes.

## Decisiones aplicadas

- Las sesiones personales pueden atravesar estados locales sin conexión.
- Solo ejercicios oficiales publicados pueden recibir nuevas series.
- Una baja conocida del ejercicio conserva las series existentes y bloquea nuevas series de ese ejercicio.
- Una serie se identifica de forma estable dentro de la sesión.
- El outbox conserva operaciones pendientes, confirmadas, bloqueadas y en recuperación; no expone eliminación automática.
- Una operación se confirma localmente solo después de un recibo cuyo `operationId` coincide.
- Un conflicto incompatible pasa a recuperación y no sobrescribe silenciosamente la edición local.
- El cursor solo avanza desde el cursor persistido del mismo ámbito.
- Un snapshot requiere manifiesto verificado, páginas de la misma generación, integridad verificada y TTL vigente.

## Lo que todavía no se declara verificado

- Persistencia en un navegador real distinto del IndexedDB simulado.
- API de sincronización conectada a PostgreSQL.
- Transacciones de publicación de cursor en una base real.
- Recuperación operacional desde backups.
