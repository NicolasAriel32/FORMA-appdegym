# Estado de verificación técnica

## Verificado en el entorno local

- TypeScript compila en modo estricto.
- Las 74 pruebas automatizadas pasan (`npm test`); el conteo se conserva explícito para detectar ejecuciones incompletas.
- La API rechaza solicitudes sin identidad y aísla perfiles personales.
- El endpoint de catálogo requiere autenticación y devuelve solamente ejercicios publicados.
- El cliente de catálogo falla cerrado cuando faltan campos educativos profesionales.
- La frontera HTTP de rutinas valida entradas y aísla las rutinas por propietario.
- La identidad externa se convierte en una identidad interna estable.
- Las consultas SQL del repositorio de identidad usan parámetros.
- Los repositorios PostgreSQL de identidad, catálogo y rutinas usan consultas parametrizadas; la creación y edición estructural de rutinas se ejecutan dentro de una transacción.
- El adaptador PostgreSQL confirma, revierte y libera conexiones correctamente ante éxito y error.
- La configuración de runtime exige URL HTTPS, credenciales server-side y un puerto válido; no se incorporan valores secretos al bundle web.
- El límite server-side de sincronización exige autenticación, valida identificadores/cursor, aplica operaciones personales de sesión dentro de una transacción, emite recibos idempotentes y conserva el cursor en la última página realmente entregada.
- El drenaje web ordena operaciones por agregado, recupera estados `sending` interrumpidos, confirma solo con recibos coincidentes y conserva errores de transporte/conflictos sin borrado automático.
- La aplicación local de `sync_changes` actualiza sesiones y cursor en una transacción IndexedDB; un cursor inesperado o cambio incompatible aborta ambos.
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
- API desplegado y `/me` conectado a PostgreSQL persistente; el código de arranque existe, pero todavía no se ejecutó contra un entorno de aplicación desplegado.
- Navegadores reales, instalación PWA y comportamiento offline entre versiones.
- Revisión visual automatizada con navegador instalado; el entorno actual no contiene un ejecutable Chromium.
- Prueba end-to-end contra una instancia desplegada y un usuario de Supabase Auth real.
- Restauración de backups, PITR, RPO y RTO.
- Reglas F5 de entrenadores y consentimiento.

Los puntos de la segunda sección no deben marcarse como implementados hasta ejecutar evidencia específica.
