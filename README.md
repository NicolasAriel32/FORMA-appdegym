# FORMA

Incrementos técnicos iniciales de FORMA: identidad interna, aislamiento de datos y frontera de autenticación web.

## Estado

Este repositorio contiene la base verificable de I1, el inicio de I2 y el primer comando offline de entrenamiento. Supabase está configurado como entorno de desarrollo, la PWA ya tiene una frontera de autenticación por correo/contraseña, el servidor tiene un resolvedor que valida bearer tokens mediante Supabase Auth y una sesión local puede persistirse junto con su outbox en una transacción atómica. El API todavía no está desplegado y no se creó ningún usuario de prueba.

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
```

## Límites deliberados de los incrementos actuales

- La sesión web no se persiste ni se renueva automáticamente: esto evita convertir almacenamiento de credenciales en una decisión offline implícita.
- Todavía no se habilitó el desbloqueo offline de la identidad.
- El comando offline de iniciar sesión existe como servicio probado, pero todavía no está expuesto en la interfaz funcional.
- No ejecuta sincronización contra una API remota.
- No implementa consentimiento ni consulta de sesiones por entrenadores.
- No contiene credenciales ni servicios de aplicación desplegados.

## Próximo paso

Cargar el catálogo oficial publicado online y exponerlo mediante el API, manteniendo el cliente `/me`, las políticas RLS y el aislamiento verificados en I1.
