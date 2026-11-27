# ADR 0009 — Ranking de pesos pesados y sesión guardada

Fecha: 2026-11-27 · Estado: aceptado · Reemplaza la parte de sesión del ADR 0003.

## Contexto

Nicolás quiere mostrar FORMA a otras personas y que cada una aparezca en un ranking de los cuatro básicos
(sentadilla, press banca plano, peso muerto convencional y press militar). Eso exige cuentas reales y datos
compartidos. El API Node todavía no está publicado.

## Decisión

- **Cuentas:** correo y contraseña con Supabase Auth. La sesión se guarda y se renueva sola
  (`persistSession`, `autoRefreshToken` y `detectSessionInUrl` en `true`). Supabase se sigue cargando bajo demanda:
  solo al abrir la app si hay una sesión guardada o un link de confirmación en la URL.
- **Ranking directo en Supabase**, sin pasar por el API: tablas `leaderboard_participants` y `leaderboard_marks`
  (migraciones 0009–0011) con RLS, y funciones `join_shared_leaderboard`, `leave_shared_leaderboard`,
  `publish_leaderboard_mark` y `get_leaderboard`.
- **Medida:** 1RM estimado con Epley (`public.estimate_1rm`); solo series de 1 a 12 repeticiones y hasta 600 kg.
  Se guarda la mejor marca de cada persona por ejercicio.
- **Tablas por sexo** (`M`/`F`), elegido al crear la cuenta.
- **Validación:** se confía en lo que carga cada persona (decisión de producto).
- **Lectura pública:** `get_leaderboard` es `security definer` y la puede llamar cualquiera, sin cuenta.
  Solo devuelve nombre visible y marca de quienes se sumaron. El aviso del linter de Supabase por esto es esperado.
- **Envío de marcas:** al finalizar un entrenamiento, la mejor serie de cada básico entra a una cola local
  (`forma.pending-marks.v1`) y se envía cuando hay cuenta y conexión. También se puede cargar a mano.

## Consecuencias

- Para que otras personas puedan crear cuenta hay que desactivar "Confirm email" en Supabase o configurar un SMTP
  propio: el correo integrado de Supabase solo envía a miembros del equipo del proyecto y con límite por hora.
- Si se mantiene la confirmación por correo, la "Site URL" de Supabase Auth tiene que ser la URL publicada de la app.
- Los entrenamientos siguen guardándose solo en el teléfono hasta publicar el API de sincronización.
