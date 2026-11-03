# ADR 0004: límite de lectura del catálogo oficial

## Estado

Aceptado para el incremento de catálogo.

## Decisión

- El catálogo se consulta con autenticación.
- El API filtra por `status = published` antes de construir la respuesta pública.
- Los ejercicios retirados permanecen en el modelo para conservar referencias históricas, pero no se entregan como opciones nuevas.
- El catálogo no concede acceso a sesiones personales ni a membresías de otros usuarios.
- Las respuestas autenticadas y las requests con credenciales no se cachean en el Service Worker.
- La ficha publicada puede incluir patrón de movimiento, músculos objetivo y secundarios, instrucciones por fases, errores frecuentes, equipamiento, dificultad y cues generales de seguridad.
- El contenido educativo es editorial del catálogo; no se acepta como texto libre del usuario ni como diagnóstico médico.

## Consecuencia

La aplicación puede construir rutinas usando únicamente ejercicios oficiales vigentes, sin convertir la pertenencia al gimnasio ni la consulta del catálogo en acceso a datos personales. La administración y la revisión humana previa a publicación quedan fuera de este incremento; el cliente falla cerrado si falta contenido editorial requerido.
