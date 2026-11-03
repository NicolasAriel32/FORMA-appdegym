# ADR 0003: Frontera inicial de autenticación web

## Estado

Aceptado para el incremento I2; sujeto a revisión antes de habilitar entrenamiento offline autenticado.

## Contexto

FORMA ya tiene una identidad interna estable, un binding con `auth.users` y políticas RLS. La PWA necesita una primera integración real con Supabase Auth, pero la política de desbloqueo offline, persistencia de credenciales y revocación local todavía no está cerrada.

## Decisión

- La PWA usa `@supabase/supabase-js` con la URL del proyecto y una clave publishable inyectadas por `VITE_SUPABASE_*`.
- La primera frontera permite iniciar y cerrar sesión online con correo y contraseña.
- El cliente usa `persistSession: false`, `autoRefreshToken: false` y `detectSessionInUrl: false`.
- El servidor valida el bearer token con Supabase Auth y no confía en datos editables de `user_metadata` para autorización.
- No se habilita entrenamiento offline autenticado, ni se almacena una sesión de refresh en el navegador, hasta aprobar una política explícita de desbloqueo, expiración, revocación y recuperación.
- Los errores del proveedor se transforman en mensajes genéricos para la interfaz.

## Consecuencias

La frontera es verificable sin secretos en el repositorio y evita prometer continuidad offline de identidad antes de definirla. A cambio, una recarga de la PWA requiere volver a autenticar y el incremento no puede probar todavía el flujo end-to-end con un usuario real.
