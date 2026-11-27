// Ranking de pesos pesados: 1RM estimado por ejercicio básico, tablas por sexo.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Demonstration } from "../ExerciseRepetition.js";

export type LiftCode = "squat" | "bench" | "deadlift" | "ohp";
export type AthleteSex = "M" | "F";
export type Lift = { code: LiftCode; name: string; demonstration: Demonstration };

export const LIFTS: readonly Lift[] = [
  { code: "squat", name: "Sentadilla con barra", demonstration: "squat" },
  { code: "bench", name: "Press banca plano", demonstration: "bench" },
  { code: "deadlift", name: "Peso muerto", demonstration: "conventional" },
  { code: "ohp", name: "Press militar", demonstration: "ohp" },
];

export const MAX_RANKED_REPS = 12;
export const MAX_RANKED_LOAD_KG = 600;

export function liftForDemonstration(demonstration: Demonstration | undefined): LiftCode | undefined {
  return LIFTS.find((lift) => lift.demonstration === demonstration)?.code;
}

/** Fórmula de Epley, igual que public.estimate_1rm en la base. Una repetición vale el peso levantado. */
export function estimate1rm(loadKg: number, repetitions: number): number {
  const raw = repetitions === 1 ? loadKg : loadKg * (1 + repetitions / 30);
  return Math.round(raw * 10) / 10;
}

export function isRankable(loadKg: number, repetitions: number): boolean {
  return Number.isFinite(loadKg) && loadKg > 0 && loadKg <= MAX_RANKED_LOAD_KG && Number.isInteger(repetitions) && repetitions >= 1 && repetitions <= MAX_RANKED_REPS;
}

export type PendingMark = { lift: LiftCode; loadKg: number; repetitions: number; recordedAt: string };

/** La mejor serie de cada básico entre las series de un entrenamiento. */
export function bestMarks(sets: ReadonlyArray<{ lift: LiftCode | undefined; loadKg: number; repetitions: number }>, recordedAt: string): PendingMark[] {
  const best = new Map<LiftCode, PendingMark>();
  for (const set of sets) {
    if (set.lift === undefined || !isRankable(set.loadKg, set.repetitions)) continue;
    const current = best.get(set.lift);
    if (current === undefined || estimate1rm(set.loadKg, set.repetitions) > estimate1rm(current.loadKg, current.repetitions)) {
      best.set(set.lift, { lift: set.lift, loadKg: set.loadKg, repetitions: set.repetitions, recordedAt });
    }
  }
  return LIFTS.flatMap((lift) => best.get(lift.code) ?? []);
}

export type LeaderboardRow = { position: number; displayName: string; loadKg: number; repetitions: number; estimated1rm: number; recordedAt: string; isMe: boolean };
export type Athlete = { displayName: string; sex: AthleteSex | null; enabled: boolean };

export async function fetchLeaderboard(client: SupabaseClient, lift: LiftCode, sex: AthleteSex): Promise<LeaderboardRow[]> {
  const { data, error } = await client.rpc("get_leaderboard", { p_exercise: lift, p_sex: sex, p_limit: 100 });
  if (error) throw new Error("No se pudo cargar el ranking.");
  return (data as Array<Record<string, unknown>>).map((row) => ({
    position: Number(row.rank_position),
    displayName: String(row.display_name),
    loadKg: Number(row.load_kg),
    repetitions: Number(row.repetitions),
    estimated1rm: Number(row.estimated_1rm),
    recordedAt: String(row.recorded_at),
    isMe: row.is_me === true,
  }));
}

export async function fetchMyAthlete(client: SupabaseClient): Promise<Athlete | null> {
  const { data, error } = await client.from("leaderboard_participants").select("display_name, sex, enabled").maybeSingle();
  if (error) throw new Error("No se pudo leer tu perfil del ranking.");
  if (data === null) return null;
  const row = data as { display_name: string; sex: string | null; enabled: boolean };
  return { displayName: row.display_name, sex: row.sex === "M" || row.sex === "F" ? row.sex : null, enabled: row.enabled };
}

export async function joinLeaderboard(client: SupabaseClient, displayName: string, sex: AthleteSex): Promise<void> {
  const { error } = await client.rpc("join_shared_leaderboard", { p_display_name: displayName.trim(), p_sex: sex });
  if (error) throw new Error("No se pudo sumarte al ranking.");
}

export async function leaveLeaderboard(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc("leave_shared_leaderboard");
  if (error) throw new Error("No se pudo salir del ranking.");
}

/** Devuelve true si la marca mejoró tu récord en ese ejercicio. */
export async function publishMark(client: SupabaseClient, mark: PendingMark): Promise<boolean> {
  const { data, error } = await client.rpc("publish_leaderboard_mark", { p_exercise: mark.lift, p_load_kg: mark.loadKg, p_repetitions: mark.repetitions, p_recorded_at: mark.recordedAt });
  if (error) throw new Error("No se pudo enviar la marca.");
  return data === true;
}

// Marcas que esperan conexión o cuenta. Se guardan en el teléfono hasta poder enviarlas.
const PENDING_KEY = "forma.pending-marks.v1";

export function readPendingMarks(storage: Pick<Storage, "getItem"> = localStorage): PendingMark[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(PENDING_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is PendingMark =>
      item !== null && typeof item === "object" &&
      LIFTS.some((lift) => lift.code === item.lift) &&
      isRankable(item.loadKg, item.repetitions) && typeof item.recordedAt === "string");
  } catch {
    return [];
  }
}

export function queueMarks(marks: PendingMark[], storage: Pick<Storage, "getItem" | "setItem"> = localStorage): void {
  if (marks.length === 0) return;
  try {
    storage.setItem(PENDING_KEY, JSON.stringify([...readPendingMarks(storage), ...marks].slice(-40)));
  } catch { /* sin espacio: se pierde la cola, no el entrenamiento */ }
}

/** Envía las marcas pendientes. Las que fallan quedan para el próximo intento. */
export async function flushPendingMarks(client: SupabaseClient, storage: Pick<Storage, "getItem" | "setItem"> = localStorage): Promise<{ sent: PendingMark[]; records: PendingMark[] }> {
  const pending = readPendingMarks(storage);
  const sent: PendingMark[] = [];
  const records: PendingMark[] = [];
  const failed: PendingMark[] = [];
  for (const mark of pending) {
    try {
      if (await publishMark(client, mark)) records.push(mark);
      sent.push(mark);
    } catch {
      failed.push(mark);
    }
  }
  try { storage.setItem(PENDING_KEY, JSON.stringify(failed)); } catch { /* reintenta la próxima vez */ }
  return { sent, records };
}

export function formatKg(value: number): string {
  return value.toLocaleString("es-AR", { maximumFractionDigits: 1 });
}
