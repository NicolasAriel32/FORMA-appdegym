export type ApiRuntimeEnv = {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  DATABASE_URL?: string;
  PORT?: string;
};

export type ApiRuntimeConfig = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  databaseUrl: string;
  port: number;
};

export class ApiConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ApiConfigurationError";
  }
}

export function readApiRuntimeConfig(environment: ApiRuntimeEnv): ApiRuntimeConfig {
  const supabaseUrl = readRequired(environment.SUPABASE_URL, "SUPABASE_URL");
  try {
    const parsed = new URL(supabaseUrl);
    if (parsed.protocol !== "https:") throw new Error("invalid protocol");
  } catch {
    throw new ApiConfigurationError("SUPABASE_URL must be an HTTPS URL");
  }
  const supabasePublishableKey = readRequired(environment.SUPABASE_PUBLISHABLE_KEY, "SUPABASE_PUBLISHABLE_KEY");
  const databaseUrl = readRequired(environment.DATABASE_URL, "DATABASE_URL");
  const port = environment.PORT === undefined || environment.PORT.trim() === "" ? 8080 : Number(environment.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ApiConfigurationError("PORT must be an integer between 1 and 65535");
  }
  return { supabaseUrl, supabasePublishableKey, databaseUrl, port };
}

function readRequired(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (normalized === undefined || normalized.length === 0) {
    throw new ApiConfigurationError(`${name} is required`);
  }
  return normalized;
}
