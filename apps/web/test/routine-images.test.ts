import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { routineImageFor, routineImages } from "../src/routineImages.js";

test("routine photos match by muscle group or name", () => {
  assert.equal(routineImageFor({ name: "Piernas · Fuerza", muscleGroup: "Piernas" }), routineImages.legs);
  assert.equal(routineImageFor({ name: "Pecho y espalda", muscleGroup: "Torso" }), routineImages.torso);
  assert.equal(routineImageFor({ name: "Full body", muscleGroup: "Cuerpo completo" }), routineImages.fullBody);
  assert.equal(routineImageFor({ name: "Día de glúteos", muscleGroup: "Plan de prueba" }), routineImages.legs);
  assert.equal(routineImageFor({ name: "Brazos", muscleGroup: "Plan personal" }), undefined);
});

test("every routine photo file exists", () => {
  for (const image of Object.values(routineImages)) {
    for (const path of [image.hero, image.thumb]) {
      assert.ok(existsSync(resolve(process.cwd(), `apps/web/public${path}`)), path);
    }
  }
});
