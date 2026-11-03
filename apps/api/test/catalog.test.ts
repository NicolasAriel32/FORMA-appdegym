import assert from "node:assert/strict";
import { once } from "node:events";
import test, { after, before } from "node:test";
import type { AddressInfo } from "node:net";
import { createApiServer } from "../src/http/create-server.js";
import { InMemoryExerciseCatalogRepository } from "../src/modules/catalog/repository.js";
import { ExerciseCatalogService } from "../src/modules/catalog/service.js";
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
      },
    ]),
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
    },
  ]);
});
