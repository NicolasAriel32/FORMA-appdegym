import { randomUUID } from "node:crypto";
import { createApiServer } from "./create-server.js";
import { PostgresExerciseCatalogRepository } from "../modules/catalog/postgres-repository.js";
import { ExerciseCatalogService } from "../modules/catalog/service.js";
import { PostgresIdentityRepository } from "../modules/identity/postgres-repository.js";
import { createSupabasePrincipalResolver, type SupabaseAuthGateway } from "../modules/identity/supabase-auth.js";
import { IdentityService } from "../modules/identity/service.js";
import { PostgresRoutineRepository } from "../modules/routines/postgres-repository.js";
import { RoutineService } from "../modules/routines/service.js";
import type { TransactionalSqlClient } from "../platform/sql-client.js";
import type { UserId } from "../modules/identity/types.js";

export type ConfiguredApiServerDependencies = {
  sqlClient: TransactionalSqlClient;
  authGateway: SupabaseAuthGateway;
  createUserId?: () => UserId;
  now?: () => string;
};

export function createConfiguredApiServer({
  sqlClient,
  authGateway,
  createUserId = () => randomUUID() as UserId,
  now = () => new Date().toISOString(),
}: ConfiguredApiServerDependencies) {
  return createApiServer({
    identityService: new IdentityService(
      new PostgresIdentityRepository(sqlClient),
      createUserId,
      now,
    ),
    resolvePrincipal: createSupabasePrincipalResolver(authGateway),
    exerciseCatalogService: new ExerciseCatalogService(
      new PostgresExerciseCatalogRepository(sqlClient),
    ),
    routineService: new RoutineService(
      new PostgresRoutineRepository(sqlClient, randomUUID, now),
    ),
  });
}
