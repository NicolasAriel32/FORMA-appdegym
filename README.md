# FORMA

Incrementos técnicos iniciales de FORMA: identidad interna, aislamiento de datos, frontera de autenticación web y persistencia PostgreSQL preparada para el API.

## Estado

Este repositorio contiene la base verificable de I1, el inicio de I2, el comando offline de entrenamiento, el catálogo educativo oficial, el editor online de rutinas, repositorios PostgreSQL parametrizados con transacciones, el límite server-side de sincronización personal y el drenaje conservador del outbox web. Supabase está configurado como entorno de desarrollo, la PWA tiene una frontera de autenticación por correo/contraseña, el servidor valida bearer tokens mediante Supabase Auth, una sesión local puede persistirse junto con su outbox en una transacción atómica y el endpoint de ejercicios filtra los publicados. El API todavía no está desplegado y no se creó ningún usuario de prueba.

La interfaz navegable está disponible con dirección visual mobile-first inspirada en Symmetry: fondo oscuro, tarjetas de entrenamiento, navegación inferior y vistas de Inicio, Rutinas, Entrenar, Progreso, Ejercicios y Perfil. Cuando faltan API e identidad mantiene una maqueta claramente marcada; con API configurado, la biblioteca consulta el catálogo publicado, la ficha muestra contenido educativo estructurado y las rutinas se crean/editan online. Una sesión autenticada persiste inicio, series y finalización localmente junto con operaciones pendientes. La pantalla de entrenamiento permite registrar carga y repeticiones, refleja los valores guardados en la tabla, recorre la secuencia de ejercicios de la rutina y activa el descanso sin reemplazar la persistencia offline del dominio. Progreso calcula métricas desde las sesiones locales autenticadas; ante operaciones bloqueadas o en recuperación, la interfaz informa el estado y conserva los datos sin resolverlos automáticamente.

La ficha completa de ejercicio incluye ahora un piloto visual 3D generado para sentadilla, con tres fases WebP precargadas por el Service Worker, loop automático de 3,3 segundos, mapa muscular 3D, vistas de ángulos, indicador de disponibilidad offline y contenido técnico de ejecución, errores y seguridad. Esta implementación valida la jerarquía y el flujo de la interfaz para sentadilla, press banca y remo; no representa todavía un asset biomecánico final ni reemplaza la revisión profesional de cada animación.

El esquema inicial fue aplicado con RLS. Las instrucciones y variables están en `docs/supabase-development.md` y `.env.example`.

El código separa la identidad externa administrada de la identidad interna estable de FORMA. La autorización es denegada por defecto para datos personales de terceros, incluidos los datos de miembros que puedan pertenecer a un entrenador.

## Requisitos

- Node.js 20 o superior.
- npm.

## Comandos

```bash
npm install
npm test
npm run build
npm run build:web
# Requiere DATABASE_URL, SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY server-side
npm run build && npm run start:api
```

## Límites deliberados de los incrementos actuales

- La sesión web no se persiste ni se renueva automáticamente: esto evita convertir almacenamiento de credenciales en una decisión offline implícita.
- La sesión offline no conserva credenciales ni permite desbloqueo offline; requiere una identidad FORMA ya validada para habilitar el flujo real.
- El catálogo educativo tiene contrato y ficha de lectura, pero la administración editorial y la revisión humana del contenido quedan fuera del cliente.
- La edición estructural de rutinas es online y no crea operaciones offline.
- La PWA drena el outbox solo cuando dispone de sesión online y API configurado; los recibos incompatibles quedan en recuperación y los errores de transporte no eliminan datos.
- No implementa consentimiento ni consulta de sesiones por entrenadores.
- No contiene credenciales ni servicios de aplicación desplegados.

## Próximo paso

Decidir y desplegar el servicio API con un proveedor aprobado, configurar `VITE_FORMA_API_URL` y ejecutar una prueba end-to-end con un usuario de Supabase Auth. Después corresponde probar la bandeja de recuperación con operaciones reales bloqueadas, validar instalación/offline en dispositivos reales, optimizar el bundle y probar restauración de backups. El API no se considera desplegado mientras esas verificaciones no existan.
