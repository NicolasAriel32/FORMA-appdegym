import assert from "node:assert/strict";
import { once } from "node:events";
import test, { after, before } from "node:test";
import type { AddressInfo } from "node:net";
import { createApiServer } from "../src/http/create-server.js";
import { InMemoryExerciseCatalogRepository } from "../src/modules/catalog/repository.js";
import { ExerciseCatalogService } from "../src/modules/catalog/service.js";
import { InMemoryRoutineRepository } from "../src/modules/routines/repository.js";
import { RoutineService } from "../src/modules/routines/service.js";
import { InMemoryIdentityRepository } from "../src/modules/identity/repository.js";
import { IdentityService } from "../src/modules/identity/service.js";
import type { UserId } from "../src/modules/identity/types.js";

let baseUrl: string;
const server = createApiServer({
  identityService: new IdentityService(
    new InMemoryIdentityRepository(),
    (() => {
      let sequence = 0;
      return () => `catalog-user-${++sequence}` as UserId;
    })(),
    () => "2026-11-03T00:00:00.000Z",
  ),
  resolvePrincipal: async (authorizationHeader) => {
    const token = authorizationHeader?.replace("Bearer test:", "");
    return token === undefined || token === authorizationHeader
      ? undefined
      : { provider: "test-auth", subject: token };
  },
  exerciseCatalogService: new ExerciseCatalogService(
    new InMemoryExerciseCatalogRepository([
      {
        id: "exercise-retired",
        slug: "old-squat",
        name: "Sentadilla antigua",
        description: "Retirado",
        status: "retired",
        createdAt: "2026-11-01T00:00:00.000Z",
        publishedAt: "2026-11-01T00:00:00.000Z",
        retiredAt: "2026-11-02T00:00:00.000Z",
        movementPattern: "squat",
        targetMuscles: ["quadriceps"],
        secondaryMuscles: ["gluteus maximus"],
        instructions: "Contenido editorial de prueba",
        commonMistakes: ["Perder el control"],
        safetyNotes: ["Usar una carga controlable"],
        equipment: "barbell",
        difficulty: "intermediate",
      },
      {
        id: "exercise-published",
        slug: "bench-press",
        name: "Press banca",
        description: "Ejercicio oficial",
        status: "published",
        createdAt: "2026-11-01T00:00:00.000Z",
        publishedAt: "2026-11-01T00:00:00.000Z",
        retiredAt: null,
        movementPattern: "horizontal_push",
        targetMuscles: ["pectoralis major"],
        secondaryMuscles: ["triceps brachii"],
        instructions: "Contenido editorial de prueba",
        commonMistakes: ["Rebotar la barra"],
        safetyNotes: ["Usar soportes adecuados"],
        equipment: "barbell",
        difficulty: "intermediate",
      },
    ]),
  ),
  routineService: new RoutineService(
    new InMemoryRoutineRepository(
      (() => {
        let sequence = 0;
        return () => `routine-${++sequence}`;
      })(),
      () => "2026-11-03T00:00:00.000Z",
    ),
  ),
});

before(async () => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  server.close();
  await once(server, "close");
});

test("catalog requires authentication", async () => {
  const response = await fetch(`${baseUrl}/exercises`);
  assert.equal(response.status, 401);
});

test("catalog exposes published official exercises only", async () => {
  const response = await fetch(`${baseUrl}/exercises`, {
    headers: { authorization: "Bearer test:member-1" },
  });
  const body = (await response.json()) as { exercises: Array<{ id: string; status: string }> };

  assert.equal(response.status, 200);
  assert.deepEqual(body.exercises, [
    {
      id: "exercise-published",
      slug: "bench-press",
      name: "Press banca",
      description: "Ejercicio oficial",
      status: "published",
      createdAt: "2026-11-01T00:00:00.000Z",
      publishedAt: "2026-11-01T00:00:00.000Z",
      retiredAt: null,
      movementPattern: "horizontal_push",
      targetMuscles: ["pectoralis major"],
      secondaryMuscles: ["triceps brachii"],
      instructions: "Contenido editorial de prueba",
      commonMistakes: ["Rebotar la barra"],
      safetyNotes: ["Usar soportes adecuados"],
      equipment: "barbell",
      difficulty: "intermediate",
    },
  ]);
});

test("routines are created and listed only for the authenticated owner", async () => {
  const createResponse = await fetch(`${baseUrl}/routines`, {
    method: "POST",
    headers: {
      authorization: "Bearer test:member-1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: "Piernas fuerza",
      description: "Bloque principal",
      exerciseIds: ["exercise-published"],
    }),
  });
  const created = (await createResponse.json()) as { id: string; ownerId: string; exercises: unknown[] };
  assert.equal(createResponse.status, 201);
  assert.equal(typeof created.ownerId, "string");
  assert.equal(created.exercises.length, 1);

  const ownerList = await fetch(`${baseUrl}/routines`, {
    headers: { authorization: "Bearer test:member-1" },
  });
  assert.equal(ownerList.status, 200);
  assert.equal(((await ownerList.json()) as { routines: unknown[] }).routines.length, 1);

  const otherOwnerList = await fetch(`${baseUrl}/routines`, {
    headers: { authorization: "Bearer test:member-2" },
  });
  assert.equal(otherOwnerList.status, 200);
  assert.equal(((await otherOwnerList.json()) as { routines: unknown[] }).routines.length, 0);
});

test("routine validation rejects duplicate exercises", async () => {
  const response = await fetch(`${baseUrl}/routines`, {
    method: "POST",
    headers: {
      authorization: "Bearer test:member-3",
      "content-type": "application/json",
    },
    body: JSON.stringify({ name: "Inválida", description: "", exerciseIds: ["x", "x"] }),
  });
  assert.equal(response.status, 400);
});
