# ADR 0001 Identidad interna y aislamiento de datos

## Estado

Aceptada para el incremento I1. La conexión con un proveedor administrado de autenticación queda pendiente.

## Contexto

FORMA necesita una identidad interna estable aunque el proveedor de autenticación cambie. La pertenencia a un gimnasio y el rol de entrenador no deben conceder acceso automático a sesiones personales.

## Decisión

- FORMA mantiene `app_users.id` como identidad interna estable.
- La identidad externa se identifica por el par `(external_provider, external_subject)`.
- El rol de aplicación no se acepta desde el cliente.
- Las autorizaciones se evalúan por recurso.
- En I1, solo el propietario puede leer su perfil o sus sesiones personales.
- La relación entrenador-miembro y el consentimiento pertenecen a F5 y no se infieren en I1.

## Consecuencias

- Se puede cambiar el proveedor sin cambiar las referencias internas.
- La API debe ejecutar la autorización antes de devolver datos personales.
- Las consultas de entrenadores requieren una política F5 posterior y no pueden reutilizar una autorización basada solamente en rol.
