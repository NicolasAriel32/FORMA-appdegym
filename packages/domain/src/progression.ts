// Progresión gamificada de FORMA: XP y niveles calculados desde sesiones.
// La XP se deriva siempre de los datos de entrenamiento; nunca se guarda
// como un valor editable, así no puede divergir de las sesiones reales.

export type ProgressionSession = {
  status: string;
  finishedAt: string | null;
  sets: ReadonlyArray<{ loadKg: number; repetitions: number }>;
};

export type LevelName = "Bronce" | "Plata" | "Oro" | "Platino" | "Diamante";

export type Progression = {
  xp: number;
  level: LevelName;
  levelIndex: number;
  levelFloorXp: number;
  nextLevel: LevelName | null;
  nextLevelXp: number | null;
  progressPercent: number;
  activeWeeksStreak: number;
};

export const XP_PER_SET = 10;
export const XP_PER_FINISHED_SESSION = 50;
export const XP_PER_STREAK_WEEK = 30;

export const levels: ReadonlyArray<{ name: LevelName; minXp: number }> = [
  { name: "Bronce", minXp: 0 },
  { name: "Plata", minXp: 500 },
  { name: "Oro", minXp: 1500 },
  { name: "Platino", minXp: 3500 },
  { name: "Diamante", minXp: 7000 },
];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const FINISHED = new Set(["finished_local", "finished_confirmed"]);

export function computeProgression(sessions: ReadonlyArray<ProgressionSession>, now: number = Date.now()): Progression {
  const finished = sessions.filter((session) => FINISHED.has(session.status));
  const validSets = finished.reduce((total, session) => total + session.sets.filter((set) => set.repetitions > 0).length, 0);
  const streak = countActiveWeeksStreak(finished, now);
  const xp = validSets * XP_PER_SET + finished.length * XP_PER_FINISHED_SESSION + streak * XP_PER_STREAK_WEEK;
  return progressionFromXp(xp, streak);
}

export function progressionFromXp(xp: number, activeWeeksStreak = 0): Progression {
  const safeXp = Math.max(0, Math.floor(xp));
  let levelIndex = 0;
  levels.forEach((level, index) => { if (safeXp >= level.minXp) levelIndex = index; });
  const current = levels[levelIndex]!;
  const next = levels[levelIndex + 1] ?? null;
  const progressPercent = next === null ? 100 : Math.round(((safeXp - current.minXp) / (next.minXp - current.minXp)) * 100);
  return {
    xp: safeXp,
    level: current.name,
    levelIndex,
    levelFloorXp: current.minXp,
    nextLevel: next?.name ?? null,
    nextLevelXp: next?.minXp ?? null,
    progressPercent,
    activeWeeksStreak,
  };
}

/** Semanas consecutivas (ventanas de 7 días hacia atrás desde `now`) con al menos una sesión finalizada. */
export function countActiveWeeksStreak(finished: ReadonlyArray<ProgressionSession>, now: number): number {
  const weekIndexes = new Set<number>();
  for (const session of finished) {
    if (session.finishedAt === null) continue;
    const finishedAt = Date.parse(session.finishedAt);
    if (!Number.isFinite(finishedAt) || finishedAt > now) continue;
    weekIndexes.add(Math.floor((now - finishedAt) / WEEK_MS));
  }
  let streak = 0;
  // La semana actual todavía puede estar en curso: si no hay sesión, la racha se cuenta desde la anterior.
  let week = weekIndexes.has(0) ? 0 : 1;
  while (weekIndexes.has(week)) { streak += 1; week += 1; }
  return streak;
}
