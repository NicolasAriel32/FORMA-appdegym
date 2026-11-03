import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ExternalPrincipal } from "./types.js";

export type SupabaseAuthGateway = {
  auth: {
    getUser: (accessToken: string) => Promise<{
      data: { user: { id: string; email?: string | null } | null };
      error: unknown | null;
    }>;
  };
};

export function createSupabaseAuthClient(
  url: string,
  publishableKey: string,
): SupabaseClient {
  return createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function createSupabasePrincipalResolver(
  gateway: SupabaseAuthGateway,
): (authorizationHeader: string | undefined) => Promise<ExternalPrincipal | undefined> {
  return async (authorizationHeader) => {
    const accessToken = extractBearerToken(authorizationHeader);
    if (accessToken === undefined) {
      return undefined;
    }

    const { data, error } = await gateway.auth.getUser(accessToken);
    if (error !== null || data.user === null) {
      return undefined;
    }

    const principal: ExternalPrincipal = {
      provider: "supabase",
      subject: data.user.id,
      authUserId: data.user.id,
    };
    if (data.user.email !== undefined && data.user.email !== null) {
      principal.email = data.user.email;
    }
    return principal;
  };
}

function extractBearerToken(header: string | undefined): string | undefined {
  if (header === undefined || !header.startsWith("Bearer ")) {
    return undefined;
  }
  const token = header.slice("Bearer ".length).trim();
  return token.length === 0 ? undefined : token;
}
