# Estado de verificación técnica

## Verificado en el entorno local

- TypeScript compila en modo estricto.
- Las 75 pruebas automatizadas pasan (`npm test`); el conteo se conserva explícito para detectar ejecuciones incompletas.
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
- La pantalla de entrenamiento permite editar carga y repeticiones, refleja los valores ingresados en la tabla demo, valida los valores inválidos y activa el temporizador de descanso después de guardar una serie.
- La pantalla de entrenamiento construye una secuencia de ejercicios desde la rutina seleccionada cuando dispone de catálogo oficial; el avance conserva la sesión y el ejercicio actual.
- Progreso calcula volumen, sesiones, mejor marca y barras semanales desde sesiones locales autenticadas; sin identidad muestra datos demo etiquetados.
- La interfaz incluye una alerta y un detalle no destructivo para operaciones `blocked` o `recovery_required`; no ofrece sobrescritura ni resolución automática.
- La vista previa incluye videos piloto de sentadilla, press de banca, peso muerto rumano y remo con barra. Requieren revisión profesional para uso como material educativo definitivo.
- IndexedDB conserva el catálogo sin una pasada de borrado, y las operaciones offline de series/finalización preservan la secuencia del agregado.
- La auditoría de npm no reportó vulnerabilidades de severidad alta o superior.
- No se detectaron secretos ni almacenamiento de tokens en `localStorage` o `sessionStorage`.

## Todavía no verificado

- Flujo de inicio de sesión contra un usuario real de Supabase Auth; no se creó un usuario de prueba automáticamente.
- API desplegado y `/me` conectado a PostgreSQL persistente; el código de arranque existe, pero todavía no se ejecutó contra un entorno de aplicación desplegado.
- Navegadores reales, instalación PWA y comportamiento offline entre versiones.
- Instalación y recorrido en teléfonos físicos. Los recorridos automatizados se ejecutaron en Chromium con viewport móvil.
- Prueba end-to-end contra una instancia desplegada y un usuario de Supabase Auth real.
- Restauración de backups, PITR, RPO y RTO.
- Reglas F5 de entrenadores y consentimiento.

Los puntos de la segunda sección no deben marcarse como implementados hasta ejecutar evidencia específica.


## Cierre del flujo personal

| Referencia CEDIR | Evidencia y límite |
| --- | --- |
| DT-37 y AR-07 | Edición online de rutinas de cuenta y copia de lectura local por cuenta. El plan demo es local y separado de la cuenta. El uso offline de rutinas de cuenta requiere identidad ya validada. |
| AR-16 y AR-24 | El inicio, el outbox y el plan se guardan juntos en IndexedDB. Al volver a autenticar, se recupera el orden y se enfoca el último ejercicio con series registradas. Para sesiones anteriores sin plan se recuperan los ejercicios de las series existentes. El plan todavía es local al dispositivo. |
| PL-328, PL-373 y PL-537 | La lista completa recibida del catálogo determina qué ejercicios se pueden usar. Si un ejercicio deja de figurar como publicado, se bloquea al iniciar una rutina que lo contiene o registrar otra serie. Se conservan las series y se puede avanzar a los demás ejercicios. El catálogo se vuelve a consultar al reconectar. |
| PL-416 | La actualización disponible usa una lista completa. La consulta incremental de catálogo y el comando manual siguen pendientes. |
| PL-633 y F4 | Pruebas locales de escritura concurrente y reintento sin sobrescribir series. El recorrido con navegador verificó reanudación y retirada con servicios simulados. Recuperación manual, snapshots remotos y verificación contra infraestructura real siguen pendientes. |
| F5 y PL-1171 | Compartir sesiones con entrenadores permanece deshabilitado. El expediente de transferencia CEDIR deja la revocación durante respuestas en tránsito pendiente de aprobación explícita. |
| AR-59 y DT-144 | Faltan despliegue verificable del API, pruebas con una identidad real y evidencia de restauración para RPO y RTO. |

Esta matriz usa el Documento Maestro CEDIR de transferencia del 03/11/2026 y los ADR del repositorio. Para un cierre exhaustivo hacen falta la constitución y los expedientes originales de criterios CA y pruebas NEG.
