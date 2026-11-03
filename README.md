# FORMA

Incrementos técnicos iniciales de FORMA: identidad interna, aislamiento de datos, frontera de autenticación web y persistencia PostgreSQL preparada para el API.

## Estado

Este repositorio contiene la base verificable de I1, el inicio de I2, el comando offline de entrenamiento, el catálogo educativo oficial, el editor online de rutinas, repositorios PostgreSQL parametrizados con transacciones y el primer límite server-side de sincronización personal. Supabase está configurado como entorno de desarrollo, la PWA tiene una frontera de autenticación por correo/contraseña, el servidor valida bearer tokens mediante Supabase Auth, una sesión local puede persistirse junto con su outbox en una transacción atómica y el endpoint de ejercicios filtra los publicados. El API todavía no está desplegado y no se creó ningún usuario de prueba.

La interfaz navegable está disponible con dirección visual mobile-first inspirada en Symmetry: fondo oscuro, tarjetas de entrenamiento, navegación inferior y vistas de Inicio, Rutinas, Entrenar, Progreso, Ejercicios y Perfil. Cuando faltan API e identidad mantiene una maqueta claramente marcada; con API configurado, la biblioteca consulta el catálogo publicado, la ficha muestra contenido educativo estructurado y las rutinas se crean/editan online. Una sesión autenticada persiste inicio, series y finalización localmente junto con operaciones pendientes.

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
- La PWA todavía no drena el outbox contra la API remota; el servidor ya expone el límite transaccional de operaciones, recibos y cursor, y el cliente será el siguiente incremento.
- No implementa consentimiento ni consulta de sesiones por entrenadores.
- No contiene credenciales ni servicios de aplicación desplegados.

## Próximo paso

Conectar el drenaje del outbox web a los endpoints server-side, agregar recuperación visual para conflictos y validar la PWA en un navegador real; después desplegar el servicio solo con un proveedor aprobado.
