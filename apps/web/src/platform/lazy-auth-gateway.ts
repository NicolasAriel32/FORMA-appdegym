import type { AuthChangeEvent, Session, SupabaseClient } from "@supabase/supabase-js";
import type { AuthGateway } from "./auth.js";
import { readBrowserSupabaseConfig, type WebSupabaseConfig } from "./supabase-config.js";

type AuthListener = (event: AuthChangeEvent, session: Session | null) => void;

export type LazyAuthGateway = AuthGateway & {
  /** Descarga Supabase en segundo plano (por ejemplo, al abrir el perfil). */
  preload: () => void;
  /** Cliente completo, para consultas como el ranking. */
  client: () => Promise<SupabaseClient>;
};

/** Hay que cargar Supabase al abrir si hay una sesión guardada o si se vuelve del link del correo. */
export function needsEagerAuth(storage: Pick<Storage, "length" | "key"> | undefined, location: Pick<Location, "hash" | "search"> | undefined): boolean {
  if (location !== undefined && /(?:access_token|error_description)=/.test(location.hash) || location !== undefined && /[?&]code=/.test(location.search)) return true;
  if (storage === undefined) return false;
  for (let index = 0; index < storage.length; index += 1) {
    if (/^sb-.+-auth-token$/.test(storage.key(index) ?? "")) return true;
  }
  return false;
}

/**
 * Gateway de autenticación que no carga @supabase/supabase-js hasta que hace falta.
 *
 * Si no hay sesión guardada ni un link de confirmación en la URL, getSession devuelve null
 * sin descargar nada; así quien no tiene cuenta abre la app más rápido.
 */
export function createLazyAuthGateway(
  config: WebSupabaseConfig,
  loadClient: (config: WebSupabaseConfig) => Promise<SupabaseClient> = defaultLoadClient,
  eager: () => boolean = () => false,
): LazyAuthGateway {
  const listeners = new Set<AuthListener>();
  let client: Promise<SupabaseClient> | null = null;

  const load = (): Promise<SupabaseClient> => {
    client ??= loadClient(config).then((created) => {
      created.auth.onAuthStateChange((event, session) => {
        for (const listener of listeners) listener(event, session);
      });
      return created;
    }).catch((error: unknown) => {
      client = null;
      throw error;
    });
    return client;
  };

  return {
    preload: () => { void load().catch(() => undefined); },
    client: load,
    auth: {
      getSession: async () => client === null && !eager()
        ? { data: { session: null }, error: null }
        : (await load()).auth.getSession(),
      signUp: async (credentials) => (await load()).auth.signUp(credentials),
      signInWithPassword: async (credentials) => (await load()).auth.signInWithPassword(credentials),
      signOut: async () => client === null
        ? { error: null }
        : (await client).auth.signOut(),
      onAuthStateChange: (callback) => {
        listeners.add(callback);
        return { data: { subscription: { unsubscribe: () => { listeners.delete(callback); } } } };
      },
    },
  };
}

export function createConfiguredLazyAuthGateway(): LazyAuthGateway | null {
  const config = readBrowserSupabaseConfig();
  if (config === undefined) return null;
  return createLazyAuthGateway(config, defaultLoadClient, () => needsEagerAuth(
    typeof localStorage === "undefined" ? undefined : localStorage,
    typeof location === "undefined" ? undefined : location,
  ));
}

async function defaultLoadClient(config: WebSupabaseConfig): Promise<SupabaseClient> {
  const { createWebSupabaseClient } = await import("./supabase-client.js");
  return createWebSupabaseClient(config);
}
