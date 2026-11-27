import assert from "node:assert/strict";
import test from "node:test";
import { BodyProfileError, estimateMacroTargets, type BodyProfile } from "../src/nutrition-targets.js";
import { computeProgression, countActiveWeeksStreak, progressionFromXp } from "../src/progression.js";

const base: BodyProfile = { sex: "male", ageYears: 26, weightKg: 75, heightCm: 175, activity: "moderate", goal: "maintain" };

test("Mifflin-St Jeor calcula BMR y mantenimiento esperados", () => {
  const result = estimateMacroTargets(base);
  // 10*75 + 6.25*175 - 5*26 + 5 = 1718.75
  assert.equal(result.bmr, 1719);
  assert.equal(result.maintenance, Math.round(1718.75 * 1.55));
  assert.equal(result.calories, 2660);
});

test("los macros suman aproximadamente las calorías objetivo", () => {
  for (const goal of ["lose", "maintain", "gain"] as const) {
    const result = estimateMacroTargets({ ...base, goal });
    const fromMacros = result.protein * 4 + result.carbs * 4 + result.fats * 9;
    assert.ok(Math.abs(fromMacros - result.calories) <= 12, `${goal}: ${fromMacros} vs ${result.calories}`);
  }
});

test("el objetivo ajusta calorías y proteína en la dirección correcta", () => {
  const lose = estimateMacroTargets({ ...base, goal: "lose" });
  const keep = estimateMacroTargets(base);
  const gain = estimateMacroTargets({ ...base, goal: "gain" });
  assert.ok(lose.calories < keep.calories && keep.calories < gain.calories);
  assert.ok(lose.protein > keep.protein);
});

test("la fórmula femenina usa la constante -161", () => {
  const male = estimateMacroTargets(base);
  const female = estimateMacroTargets({ ...base, sex: "female" });
  assert.equal(male.bmr - female.bmr, 166);
});

test("rechaza datos corporales fuera de rango", () => {
  assert.throws(() => estimateMacroTargets({ ...base, weightKg: 10 }), BodyProfileError);
  assert.throws(() => estimateMacroTargets({ ...base, heightCm: Number.NaN }), BodyProfileError);
  assert.throws(() => estimateMacroTargets({ ...base, ageYears: 12 }), BodyProfileError);
});

const now = Date.parse("2026-11-27T12:00:00.000Z");
const daysAgo = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
const finishedSession = (days: number, sets = 3) => ({ status: "finished_local", finishedAt: daysAgo(days), sets: Array.from({ length: sets }, () => ({ loadKg: 60, repetitions: 8 })) });

test("sin sesiones arranca en Bronce con 0 XP", () => {
  const result = computeProgression([], now);
  assert.equal(result.xp, 0);
  assert.equal(result.level, "Bronce");
  assert.equal(result.nextLevel, "Plata");
  assert.equal(result.progressPercent, 0);
});

test("solo cuentan sesiones finalizadas y series válidas", () => {
  const result = computeProgression([
    finishedSession(1, 4),
    { status: "in_progress", finishedAt: null, sets: [{ loadKg: 50, repetitions: 10 }] },
  ], now);
  // 4 series * 10 + 1 sesión * 50 + racha 1 semana * 30
  assert.equal(result.xp, 120);
  assert.equal(result.activeWeeksStreak, 1);
});

test("la racha semanal se corta con una semana vacía", () => {
  const sessions = [finishedSession(2), finishedSession(9), finishedSession(30)];
  assert.equal(countActiveWeeksStreak(sessions, now), 2);
});

test("la racha no se pierde si la semana actual todavía no tiene sesión", () => {
  assert.equal(countActiveWeeksStreak([finishedSession(8), finishedSession(15)], now), 2);
});

test("los umbrales de nivel se respetan y Diamante es el tope", () => {
  assert.equal(progressionFromXp(499).level, "Bronce");
  assert.equal(progressionFromXp(500).level, "Plata");
  assert.equal(progressionFromXp(1000).progressPercent, 50);
  const top = progressionFromXp(9000);
  assert.equal(top.level, "Diamante");
  assert.equal(top.nextLevel, null);
  assert.equal(top.progressPercent, 100);
});
