# FORMA

Primer incremento técnico de FORMA: identidad interna y aislamiento de datos.

## Estado

Este repositorio contiene únicamente la base verificable del incremento I1. El proveedor de autenticación, PostgreSQL administrado y los servicios de despliegue todavía no están configurados.

El código separa la identidad externa administrada de la identidad interna estable de FORMA. La autorización es denegada por defecto para datos personales de terceros, incluidos los datos de miembros que puedan pertenecer a un entrenador.

## Requisitos

- Node.js 20 o superior.
- npm.

## Comandos

```bash
npm install
npm test
npm run build
```

## Límites deliberados del incremento I1

- No implementa sesiones de entrenamiento.
- No implementa sincronización offline.
- No implementa consentimiento ni consulta de sesiones por entrenadores.
- No configura proveedores externos.
- No contiene credenciales ni servicios desplegados.

## Próximo paso

Conectar el adaptador de resolución de identidad a un proveedor administrado aprobado, conservando el límite de la API y las reglas de aislamiento verificadas en I1.
