// Estimación de metas diarias de energía y macronutrientes.
// Usa la ecuación de Mifflin-St Jeor como punto de partida editable.
// No es una prescripción: la interfaz debe presentarlo como estimación.

export type BiologicalSex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "high" | "very_high";
export type BodyGoal = "lose" | "maintain" | "gain";

export type BodyProfile = {
  sex: BiologicalSex;
  ageYears: number;
  weightKg: number;
  heightCm: number;
  activity: ActivityLevel;
  goal: BodyGoal;
};

export type MacroTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  bmr: number;
  maintenance: number;
};

export class BodyProfileError extends Error {
  constructor(message: string, readonly field: keyof BodyProfile) {
    super(message);
    this.name = "BodyProfileError";
  }
}

export const activityMultipliers: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  very_high: 1.9,
};

const goalCalorieFactor: Record<BodyGoal, number> = { lose: 0.85, maintain: 1, gain: 1.1 };
const proteinPerKg: Record<BodyGoal, number> = { lose: 2, maintain: 1.6, gain: 1.8 };
const FAT_SHARE = 0.25;
const MIN_FAT_PER_KG = 0.6;

export function validateBodyProfile(profile: BodyProfile): void {
  if (profile.sex !== "male" && profile.sex !== "female") throw new BodyProfileError("Elegí una opción de sexo para la fórmula.", "sex");
  if (!Number.isFinite(profile.ageYears) || profile.ageYears < 16 || profile.ageYears > 90) throw new BodyProfileError("La edad debe estar entre 16 y 90 años.", "ageYears");
  if (!Number.isFinite(profile.weightKg) || profile.weightKg < 35 || profile.weightKg > 250) throw new BodyProfileError("El peso debe estar entre 35 y 250 kg.", "weightKg");
  if (!Number.isFinite(profile.heightCm) || profile.heightCm < 130 || profile.heightCm > 230) throw new BodyProfileError("La altura debe estar entre 130 y 230 cm.", "heightCm");
  if (!(profile.activity in activityMultipliers)) throw new BodyProfileError("Elegí un nivel de actividad.", "activity");
  if (!(profile.goal in goalCalorieFactor)) throw new BodyProfileError("Elegí un objetivo.", "goal");
}

export function estimateMacroTargets(profile: BodyProfile): MacroTargets {
  validateBodyProfile(profile);
  const sexConstant = profile.sex === "male" ? 5 : -161;
  const bmr = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.ageYears + sexConstant;
  const maintenance = bmr * activityMultipliers[profile.activity];
  const calories = roundTo(maintenance * goalCalorieFactor[profile.goal], 10);
  const protein = Math.round(profile.weightKg * proteinPerKg[profile.goal]);
  const fats = Math.round(Math.max((calories * FAT_SHARE) / 9, profile.weightKg * MIN_FAT_PER_KG));
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fats * 9) / 4));
  return { calories, protein, carbs, fats, bmr: Math.round(bmr), maintenance: Math.round(maintenance) };
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}
