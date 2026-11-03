# ADR 0005: dirección inicial de interfaz

## Estado

Aceptada para el primer incremento visual de la PWA.

## Decisión

- FORMA adopta una experiencia mobile-first de fondo oscuro, con tarjetas elevadas, gradientes violeta/azul y estados de conexión visibles.
- La navegación principal mantiene cinco destinos: Inicio, Rutinas, Entrenar, Progreso y Ejercicios.
- Perfil se abre desde el encabezado para no quitar espacio a los flujos de entrenamiento.
- Entrenar es la acción central y queda destacada en la navegación inferior.
- La pantalla de entrenamiento prioriza series, carga, repeticiones, progreso y continuidad offline, con mínima distracción.
- Las primeras pantallas usan datos de demostración claramente marcados; no representan datos reales del usuario.
- La referencia de experiencia es Symmetry, pero FORMA utiliza composición, textos, iconografía y sistema visual propios.

## Alcance de este incremento

Se implementan la carcasa navegable, Inicio, Rutinas, Entrenar, Progreso, Ejercicios y Perfil. La conexión de esas vistas con catálogo, rutinas, estadísticas y sesiones reales queda para incrementos posteriores.
