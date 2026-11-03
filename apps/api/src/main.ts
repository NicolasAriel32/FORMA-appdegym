import { createConfiguredApiServer } from "./http/create-configured-server.js";
import { createSupabaseAuthClient } from "./modules/identity/supabase-auth.js";
import { createPostgresSqlClient } from "./platform/postgres-client.js";
import { readApiRuntimeConfig } from "./runtime-config.js";

const config = readApiRuntimeConfig(process.env);
const database = createPostgresSqlClient(config.databaseUrl);
const supabase = createSupabaseAuthClient(config.supabaseUrl, config.supabasePublishableKey);
const server = createConfiguredApiServer({ sqlClient: database, authGateway: supabase });

server.listen(config.port, () => {
  console.log(`FORMA API listening on port ${config.port}`);
});

async function shutdown(): Promise<void> {
  await database.close();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error === undefined ? resolve() : reject(error));
  });
}

process.once("SIGTERM", () => { void shutdown(); });
process.once("SIGINT", () => { void shutdown(); });
