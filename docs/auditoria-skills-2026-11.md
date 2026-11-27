# Auditoría FORMA con skills (noviembre 2026)

Base: rama `codex/forma-ficha-movil-sentadilla` (la más avanzada). Skills aplicadas: app-prd-architect (producto), web-design-guidelines (Vercel, UX/accesibilidad), vercel-react-best-practices (React), supabase + supabase-postgres-best-practices (datos).

## Visión del producto
App de musculación mobile-first: ejercicios con técnica 3D, rutinas, entrenamiento con registro de series (offline), nutrición (perfil corporal → metas, registro de comidas, a futuro foto de comida → calorías/macros) y progreso gamificado (XP y niveles Bronce → Diamante).

## Hallazgos por prioridad

### P0 — bloquean que un usuario real use la app
1. **El API no está desplegado.** Todo usuario ve datos demo. Opciones: (a) desplegar `apps/api` como Cloudflare Worker, o (b) que la PWA hable directo con Supabase usando las políticas RLS que ya existen y dejar el API solo para sync.
2. **No hay registro de cuenta**, solo inicio de sesión. Falta `signUp` + confirmación de correo.
3. **La sesión no se guarda** (`persistSession: false`, ADR 0003): cada recarga pide login. Para una PWA de gimnasio es una fricción grave. Requiere revisar la decisión del ADR.
4. **El proyecto Supabase "FORMA" está pausado** (INACTIVE).

### P1 — producto
5. Nutrición: metas cargadas a mano → **resuelto en esta rama** con calculadora (Mifflin-St Jeor).
6. Gamificación XP/niveles no existía en el código → **resuelto en esta rama** (`packages/domain/src/progression.ts`).
7. Nutrición se guarda en `localStorage` y no se sincroniza: se pierde al cambiar de celular. Mover a Supabase (tabla `nutrition_entries` con RLS por `auth.uid()`).
8. Foto de comida → macros: falta. Requiere Edge Function de Supabase que llame a la API de Claude (nunca exponer la clave en el cliente).

### P1 — UX móvil (web-design-guidelines) → resuelto en esta rama
- Campos con 12–13px: iOS hacía zoom al tocarlos → 16px.
- `outline: 0` sin reemplazo en buscador, editor y series → foco visible global.
- Textos de 9px en la navegación → mínimo legible.
- Mensajes de estado sin `role="status"` → lectores de pantalla los anuncian.
- Sin `touch-action`, `overscroll-behavior` en modales, `tabular-nums`, `prefers-reduced-motion` global, `inputMode` en campos numéricos, favicon.

### P2 — código (react-best-practices)
9. `App.tsx` tiene ~900 líneas con líneas de hasta 4.000 caracteres y ~45 `useState` en un solo componente: cada tecla del buscador o del login re-renderiza toda la app. Dividir por pantalla (`views/HomeView.tsx`, etc.) y bajar el estado a cada vista.
10. Bundle único de 540 KB (150 KB gzip). Cargar con `React.lazy` la ficha de ejercicio y Nutrición.

### Datos (supabase skills)
- RLS bien aplicado y con el patrón recomendado `(select auth.uid())`. `sync_changes` sin política de cliente a propósito: correcto.
- Pendiente al reactivar el proyecto: correr los advisors de seguridad y performance.

## Hecho en la rama `mejoras-skills`
- `packages/domain/src/nutrition-targets.ts` + tests.
- `packages/domain/src/progression.ts` + tests (XP: 10 por serie, 50 por sesión finalizada, 30 por semana de racha).
- Calculadora en Nutrición y tarjeta de nivel en Progreso.
- Ajustes móviles y de accesibilidad listados arriba.
- 85/85 tests, build OK, verificado en navegador a 360 y 390 px.

---

# Segunda revisión (27/11, después de sumar 20 ejercicios)

## Mediciones (vista de celular)
- **Lighthouse (inicio):** rendimiento 100, accesibilidad 100, buenas prácticas 100. LCP 0,8 s, sin saltos de diseño.
- **axe (7 pantallas: inicio, ejercicios, ficha, entrenar, progreso, nutrición, calculadora):** 2 problemas → corregidos, ahora 0.
- **Bundle JS:** 571 KB (158 KB gzip). Lighthouse marca ~114 KB sin usar en la pantalla de inicio.

## Corregido en esta revisión
1. **Caché offline:** el service worker bajaba ~5 MB al instalar (23 videos, 23 portadas y 1,6 MB de imágenes de sentadilla que ya no se usan) y lo volvía a bajar con cada versión. Ahora instala solo la app (7 archivos); cada video y portada se guarda la primera vez que se abre esa ficha, en un caché propio (`forma-media-vN`) que sobrevive a las actualizaciones. Verificado: el video abierto se reproduce sin conexión.
   - Si se reemplaza un video o una portada existente, subir `MEDIA_VERSION` en `sw.js`.
2. **Contraste de la barra de navegación:** pestañas inactivas de 3,6:1 a 5,6:1 (AA).
3. **Gráfico de Progreso:** `role="img"` para que el lector de pantalla lea su etiqueta.
4. **Catálogo separado:** fichas y asociación ejercicio→animación pasaron de `App.tsx` (112 KB → 79 KB) a `src/exerciseCatalog.ts`; la cadena de 23 `if` es ahora una tabla.
5. **Tests nuevos (91 en total):** cada ejercicio tiene animación, video, portada y metadatos; nombres del catálogo real se asocian bien. Detectaron que press banca, peso muerto rumano y remo con barra no tenían `metadata.json` → agregados.

## Pendiente (requiere decisión o más trabajo)
- **P0 sin cambios:** API sin desplegar, sin registro de cuenta, sesión que no persiste, proyecto Supabase pausado.
- **Botón "Descargar ejercicios para usar sin conexión"** en Perfil, para quien quiera bajar todos los videos con Wi-Fi.
- **Dividir el bundle:** cargar Nutrición y la ficha de ejercicio bajo demanda (~114 KB menos al abrir).
- **App.tsx** sigue con ~57 `useState` en un solo componente: separar por pantalla.
- **Avisar en la ficha** cuando el video es provisorio (los 6 que esperan una imagen).
