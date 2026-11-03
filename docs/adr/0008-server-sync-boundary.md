# ADR 0008: límite server-side de sincronización personal

## Estado

Aceptada para el primer incremento de sincronización. No incluye entrenadores, consentimiento ni revocación.

## Decisión

- `POST /sync/operations` requiere autenticación y atribuye la operación al usuario interno derivado del bearer token; el cliente no puede elegir el propietario.
- `operationId` es la clave de idempotencia. El mismo identificador con contenido distinto se conserva como conflicto y nunca reemplaza la evidencia original.
- La aplicación del comando y la publicación de `sync_changes` ocurren dentro de la misma transacción PostgreSQL que actualiza `sync_operations`.
- El orden del agregado personal se controla mediante `sequence` y `server_revision`; una operación adelantada es retryable y una operación incompatible no sobrescribe datos.
- Las páginas incrementales devuelven como `nextCursor` el último cursor incluido en la página. No se saltean cambios posteriores cuando el servidor limita el tamaño de la página.
- El primer agregado soportado es `workout_session` con inicio, agregado de serie y finalización. Los tipos o contratos desconocidos devuelven `unsupported` y no se aplican parcialmente.
- Los inicios provenientes del outbox conservan `startEvidence: local_time_unverified`; este incremento no los transforma en evidencia de consentimiento para entrenadores.

## Consecuencia

El servidor ya tiene una frontera transaccional comprobable para conectar el outbox, pero el cliente todavía debe implementar el drenaje, la confirmación local, los reintentos y la UI de recuperación. La política PL-1171 permanece sin resolver y no se permite inferir una decisión desde este ADR.
