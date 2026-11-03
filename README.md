# FORMA

Primer incremento técnico de FORMA: identidad interna y aislamiento de datos.

## Estado

Este repositorio contiene la base verificable del incremento I1. Supabase ya fue seleccionado y configurado como entorno de desarrollo; la integración completa de autenticación en la PWA, el API desplegado y producción todavía no están habilitados.

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

## Límites deliberados del incremento I1

- No conecta todavía autenticación administrada ni PostgreSQL.
- No implementa todavía la interfaz funcional de sesiones.
- No ejecuta sincronización contra una API remota.
- No implementa consentimiento ni consulta de sesiones por entrenadores.
- No configura proveedores externos.
- No contiene credenciales ni servicios desplegados.

## Próximo paso

Conectar el adaptador de resolución de identidad a un proveedor administrado aprobado, conservando el límite de la API y las reglas de aislamiento verificadas en I1.
