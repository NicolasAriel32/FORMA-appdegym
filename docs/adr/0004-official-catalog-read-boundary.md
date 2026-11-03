# ADR 0004: límite de lectura del catálogo oficial

## Estado

Aceptado para el incremento de catálogo.

## Decisión

- El catálogo se consulta con autenticación.
- El API filtra por `status = published` antes de construir la respuesta pública.
- Los ejercicios retirados permanecen en el modelo para conservar referencias históricas, pero no se entregan como opciones nuevas.
- El catálogo no concede acceso a sesiones personales ni a membresías de otros usuarios.
- Las respuestas autenticadas y las requests con credenciales no se cachean en el Service Worker.

## Consecuencia

La aplicación puede construir rutinas usando únicamente ejercicios oficiales vigentes, sin convertir la pertenencia al gimnasio ni la consulta del catálogo en acceso a datos personales. La administración del catálogo queda fuera de este incremento.
