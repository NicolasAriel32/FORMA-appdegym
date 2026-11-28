import assert from "node:assert/strict";
import test from "node:test";
import { estimateRoutineMinutes, estimateUniformMinutes, formatRestSeconds, formatRoutineMinutes, isValidRestSeconds } from "../src/routineDuration.js";

test("6 ejercicios de 4 series con 2 minutos de descanso duran unos 62 minutos", () => {
  // 24 series × 45 s + 18 descansos × 120 s + 5 cambios × 90 s = 3690 s
  assert.equal(estimateUniformMinutes(6, 120, 4), 62);
});

test("después de la última serie no se descansa", () => {
  assert.equal(estimateRoutineMinutes([{ sets: 1, restSeconds: 600 }]), 1);
  assert.equal(estimateRoutineMinutes([{ sets: 2, restSeconds: 60 }]), 3); // 90 s + 60 s = 150 s
});

test("más descanso da una rutina más larga", () => {
  assert.ok(estimateUniformMinutes(5, 180) > estimateUniformMinutes(5, 60));
});

test("cada ejercicio usa sus propias series y su descanso", () => {
  // (3×45 + 2×90) + (5×45 + 4×60) + 90 = 315 + 465 + 90 = 870 s
  assert.equal(estimateRoutineMinutes([{ sets: 3, restSeconds: 90 }, { sets: 5, restSeconds: 60 }]), 15);
});

test("una rutina vacía dura 0 minutos", () => {
  assert.equal(estimateRoutineMinutes([]), 0);
});

test("formatos de duración y descanso", () => {
  assert.equal(formatRoutineMinutes(52), "~52 min");
  assert.equal(formatRoutineMinutes(75), "~75 min");
  assert.equal(formatRestSeconds(90), "1:30 min");
  assert.equal(formatRestSeconds(120), "2 min");
});

test("descansos válidos", () => {
  assert.ok(isValidRestSeconds(90));
  assert.ok(!isValidRestSeconds(0));
  assert.ok(!isValidRestSeconds("120"));
  assert.ok(!isValidRestSeconds(1.5));
});
