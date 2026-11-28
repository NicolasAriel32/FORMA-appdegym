// Estimación de cuánto dura una rutina.
// Cuenta el trabajo de cada serie, el descanso entre series del mismo ejercicio
// (después de la última serie no se descansa) y el cambio de un ejercicio al siguiente.

/** Tiempo de trabajo de una serie, en segundos. */
export const secondsPerSet = 45;
/** Tiempo para pasar al ejercicio siguiente (acomodar la máquina, cargar peso), en segundos. */
export const changeoverSeconds = 90;
/** Descanso entre series si el usuario no eligió otro, en segundos. */
export const defaultRestSeconds = 120;
/** Series por ejercicio si la rutina no las indica. */
export const defaultSetsPerExercise = 3;
/** Opciones de descanso para elegir en una rutina, en segundos. */
export const restOptions = [60, 90, 120, 180] as const;

export type DurationExercise = { sets: number; restSeconds: number };

/** Minutos estimados de la rutina, redondeados. 0 si no tiene ejercicios. */
export function estimateRoutineMinutes(exercises: readonly DurationExercise[]): number {
  if (exercises.length === 0) return 0;
  const seconds = exercises.reduce((total, { sets, restSeconds }) => {
    const series = Math.max(1, Math.round(sets));
    return total + series * secondsPerSet + (series - 1) * Math.max(0, restSeconds);
  }, 0) + (exercises.length - 1) * changeoverSeconds;
  return Math.max(1, Math.round(seconds / 60));
}

/** Misma cantidad de series y descanso para todos los ejercicios. */
export function estimateUniformMinutes(exerciseCount: number, restSeconds: number, sets = defaultSetsPerExercise): number {
  return estimateRoutineMinutes(Array.from({ length: exerciseCount }, () => ({ sets, restSeconds })));
}

/** "~62 min". En el gimnasio se habla en minutos, también pasada la hora. */
export function formatRoutineMinutes(minutes: number): string {
  return `~${minutes} min`;
}

/** "1 min", "1:30 min", "2 min". */
export function formatRestSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} min` : `${minutes}:${String(rest).padStart(2, "0")} min`;
}

export function isValidRestSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 15 && value <= 3600;
}
