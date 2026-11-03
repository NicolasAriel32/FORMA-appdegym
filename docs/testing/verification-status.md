# Estado de verificación técnica

## Verificado en el entorno local

- TypeScript compila en modo estricto.
- Las pruebas automatizadas pasan (cantidad exacta verificada por `npm test` en cada incremento).
- La API rechaza solicitudes sin identidad y aísla perfiles personales.
- La identidad externa se convierte en una identidad interna estable.
- Las consultas SQL del repositorio de identidad usan parámetros.
- El núcleo de sesiones respeta propiedad, estados, ejercicios publicados y conflictos.
- El outbox conserva operaciones, exige recibos coincidentes y no elimina conflictos.
- El cursor exige continuidad de ámbito y cursor.
- Los snapshots exigen manifiesto verificado, páginas completas, misma generación y TTL vigente.
- IndexedDB simulado confirma persistencia atómica de sesión y outbox.
- El inicio offline conserva evidencia local no verificable y rechaza la reutilización incompatible de `operationId`.
- La PWA compila; el manifest y el Service Worker fueron comprobados sintácticamente.
- La auditoría de npm no reportó vulnerabilidades de severidad alta o superior.
- No se detectaron secretos ni almacenamiento de tokens en `localStorage` o `sessionStorage`.

## Todavía no verificado

- Flujo de inicio de sesión contra un usuario real de Supabase Auth; no se creó un usuario de prueba automáticamente.
- API desplegado y `/me` conectado a PostgreSQL persistente.
- Navegadores reales, instalación PWA y comportamiento offline entre versiones.
- API remota de sincronización.
- Restauración de backups, PITR, RPO y RTO.
- Reglas F5 de entrenadores y consentimiento.

Los puntos de la segunda sección no deben marcarse como implementados hasta ejecutar evidencia específica.
