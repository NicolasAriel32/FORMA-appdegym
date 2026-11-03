# Estado de verificación técnica

## Verificado en el entorno local

- TypeScript compila en modo estricto.
- Las pruebas automatizadas pasan (cantidad exacta verificada por `npm test` en cada incremento).
- La API rechaza solicitudes sin identidad y aísla perfiles personales.
- El endpoint de catálogo requiere autenticación y devuelve solamente ejercicios publicados.
- El cliente de catálogo falla cerrado cuando faltan campos educativos profesionales.
- La frontera HTTP de rutinas valida entradas y aísla las rutinas por propietario.
- La identidad externa se convierte en una identidad interna estable.
- Las consultas SQL del repositorio de identidad usan parámetros.
- El núcleo de sesiones respeta propiedad, estados, ejercicios publicados y conflictos.
- El outbox conserva operaciones, exige recibos coincidentes y no elimina conflictos.
- El cursor exige continuidad de ámbito y cursor.
- Los snapshots exigen manifiesto verificado, páginas completas, misma generación y TTL vigente.
- IndexedDB simulado confirma persistencia atómica de sesión y outbox.
- El inicio offline conserva evidencia local no verificable y rechaza la reutilización incompatible de `operationId`.
- La PWA compila; el manifest y el Service Worker fueron comprobados sintácticamente.
- El Service Worker no cachea respuestas autenticadas ni rutas privadas del API.
- La interfaz navegable compila con Inicio, Rutinas, Entrenar, Progreso, Ejercicios y Perfil; los datos demo están marcados, mientras que el detalle de catálogo, la edición online de rutinas y los comandos locales de entrenamiento tienen límites explícitos.
- IndexedDB conserva el catálogo sin una pasada de borrado, y las operaciones offline de series/finalización preservan la secuencia del agregado.
- La auditoría de npm no reportó vulnerabilidades de severidad alta o superior.
- No se detectaron secretos ni almacenamiento de tokens en `localStorage` o `sessionStorage`.

## Todavía no verificado

- Flujo de inicio de sesión contra un usuario real de Supabase Auth; no se creó un usuario de prueba automáticamente.
- API desplegado y `/me` conectado a PostgreSQL persistente.
- Navegadores reales, instalación PWA y comportamiento offline entre versiones.
- Revisión visual automatizada con navegador instalado; el entorno actual no contiene un ejecutable Chromium.
- API remota de sincronización.
- Restauración de backups, PITR, RPO y RTO.
- Reglas F5 de entrenadores y consentimiento.

Los puntos de la segunda sección no deben marcarse como implementados hasta ejecutar evidencia específica.
