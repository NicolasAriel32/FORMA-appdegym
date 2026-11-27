// Configuración de Supabase sin importar la librería: así la app abre sin cargar ~200 KB de Supabase.
export type WebRuntimeEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
};

export type WebSupabaseConfig = {
  url: string;
  publishableKey: string;
};

export const WEB_AUTH_OPTIONS = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
} as const;

export function readWebSupabaseConfig(
  environment: WebRuntimeEnv,
): WebSupabaseConfig | undefined {
  const url = environment.VITE_SUPABASE_URL?.trim();
  const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (url === undefined || publishableKey === undefined) {
    return undefined;
  }
  if (url.length === 0 || publishableKey.length === 0 || !isHttpUrl(url)) {
    return undefined;
  }

  return { url, publishableKey };
}

export function readBrowserSupabaseConfig(): WebSupabaseConfig | undefined {
  const environment = (import.meta as ImportMeta & { env?: WebRuntimeEnv }).env ?? {};
  return readWebSupabaseConfig(environment);
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
