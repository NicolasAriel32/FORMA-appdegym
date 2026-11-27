import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { demoExercises, demonstrationFor, demonstrationRules } from "../src/exerciseCatalog.js";

const mediaRoot = resolve(process.cwd(), "apps/web/public/media/exercises");
const repetitionSource = readFileSync(resolve(process.cwd(), "apps/web/src/ExerciseRepetition.tsx"), "utf8");

test("cada ejercicio demo tiene una animación asociada", () => {
  for (const exercise of demoExercises) {
    assert.ok(demonstrationFor(exercise), `${exercise.name} no tiene animación`);
  }
});

test("los ids de ejercicios demo y las animaciones no se repiten", () => {
  assert.equal(new Set(demoExercises.map((exercise) => exercise.id)).size, demoExercises.length);
  assert.equal(new Set(demonstrationRules.map((rule) => rule.key)).size, demonstrationRules.length);
});

test("los nombres que vienen del catálogo real se asocian a la animación correcta", () => {
  const byName = (name: string) => demonstrationFor({ id: "api-123", name });
  assert.equal(byName("Sentadilla trasera con barra"), "squat");
  assert.equal(byName("Peso muerto rumano"), "deadlift");
  assert.equal(byName("Peso muerto"), "conventional");
  assert.equal(byName("Press banca plano"), "bench");
  assert.equal(byName("Press inclinado con mancuernas"), "incline");
  assert.equal(byName("Curl con barra"), "bbcurl");
  assert.equal(byName("Curl martillo"), "hammer");
  assert.equal(byName("Jalón al pecho"), "pulldown");
  assert.equal(byName("Remo con barra"), "row");
  assert.equal(byName("Remo sentado en polea"), "cablerow");
  assert.equal(byName("Ejercicio inventado"), undefined);
});

test("cada animación usada en la app tiene video, portada y metadatos", () => {
  const folders = [...repetitionSource.matchAll(/folder: "\/media\/exercises\/([a-z0-9-]+)"/g)].map((match) => match[1]!);
  assert.ok(folders.length >= demonstrationRules.length, "faltan carpetas de media en ExerciseRepetition");
  for (const folder of folders) {
    for (const file of ["repetition-pilot.mp4", "poster.webp", "metadata.json"]) {
      assert.ok(existsSync(resolve(mediaRoot, folder, file)), `${folder}/${file} no existe`);
    }
    const metadata = JSON.parse(readFileSync(resolve(mediaRoot, folder, "metadata.json"), "utf8")) as { status?: string; targetMuscles?: unknown[] };
    assert.ok(Array.isArray(metadata.targetMuscles) && metadata.targetMuscles.length > 0, `${folder} sin músculos principales`);
  }
  assert.ok(readdirSync(mediaRoot).length > 0);
});
