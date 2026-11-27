import type { AuthChangeEvent, Session, SupabaseClient } from "@supabase/supabase-js";
import type { AuthGateway } from "./auth.js";
import { readBrowserSupabaseConfig, type WebSupabaseConfig } from "./supabase-config.js";

type AuthListener = (event: AuthChangeEvent, session: Session | null) => void;

export type LazyAuthGateway = AuthGateway & {
  /** Descarga Supabase en segundo plano (por ejemplo, al abrir el perfil). */
  preload: () => void;
};

/**
 * Gateway de autenticación que no carga @supabase/supabase-js hasta que hace falta.
 *
 * Con WEB_AUTH_OPTIONS.persistSession = false no hay sesión guardada al abrir la app,
 * así que mientras el cliente no se cargó, getSession devuelve null sin descargar nada.
 * Si algún día se activa persistSession, getSession tiene que cargar el cliente siempre.
 */
export function createLazyAuthGateway(
  config: WebSupabaseConfig,
  loadClient: (config: WebSupabaseConfig) => Promise<SupabaseClient> = defaultLoadClient,
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
    auth: {
      getSession: async () => client === null
        ? { data: { session: null }, error: null }
        : (await client).auth.getSession(),
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
  return config === undefined ? null : createLazyAuthGateway(config);
}

async function defaultLoadClient(config: WebSupabaseConfig): Promise<SupabaseClient> {
  const { createWebSupabaseClient } = await import("./supabase-client.js");
  return createWebSupabaseClient(config);
}
