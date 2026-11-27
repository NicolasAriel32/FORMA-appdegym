import type {
  AuthChangeEvent,
  Session,
} from "@supabase/supabase-js";

export type AuthGateway = {
  auth: {
    getSession: () => Promise<{
      data: { session: Session | null };
      error: { message: string } | null;
    }>;
    signInWithPassword: (credentials: {
      email: string;
      password: string;
    }) => Promise<{
      data: { session: Session | null };
      error: { message: string } | null;
    }>;
    signUp: (credentials: {
      email: string;
      password: string;
      options?: { data?: Record<string, unknown>; emailRedirectTo?: string };
    }) => Promise<{
      data: { session: Session | null };
      error: { message: string } | null;
    }>;
    signOut: () => Promise<{ error: { message: string } | null }>;
    onAuthStateChange: (
      callback: (event: AuthChangeEvent, session: Session | null) => void,
    ) => { data: { subscription: { unsubscribe: () => void } } };
  };
};

export class WebAuthError extends Error {
  constructor(
    message: string,
    readonly code: "invalid_input" | "auth_failed" | "session_unavailable" | "sign_out_failed" | "session_load_failed" | "sign_up_failed",
  ) {
    super(message);
    this.name = "WebAuthError";
  }
}

export async function loadCurrentSession(
  gateway: AuthGateway,
): Promise<Session | null> {
  const { data, error } = await gateway.auth.getSession();
  if (error !== null) {
    throw new WebAuthError(
      "No se pudo cargar la sesión.",
      "session_load_failed",
    );
  }
  return data.session;
}

export async function signInWithPassword(
  gateway: AuthGateway,
  email: string,
  password: string,
): Promise<Session> {
  const normalizedEmail = email.trim();
  if (normalizedEmail.length === 0 || password.length === 0) {
    throw new WebAuthError(
      "Ingresá correo y contraseña.",
      "invalid_input",
    );
  }

  const { data, error } = await gateway.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  if (error !== null) {
    throw new WebAuthError(
      "No se pudo iniciar sesión con esos datos.",
      "auth_failed",
    );
  }
  if (data.session === null) {
    throw new WebAuthError(
      "La autenticación no devolvió una sesión válida.",
      "session_unavailable",
    );
  }
  return data.session;
}

export type SignUpProfile = { displayName: string; sex: "M" | "F" };

/** Crea la cuenta. Devuelve la sesión, o null si Supabase pide confirmar el correo primero. */
export async function signUpWithPassword(
  gateway: AuthGateway,
  email: string,
  password: string,
  profile: SignUpProfile,
  redirectTo?: string,
): Promise<Session | null> {
  const normalizedEmail = email.trim();
  const displayName = profile.displayName.trim();
  if (normalizedEmail.length === 0 || displayName.length === 0) {
    throw new WebAuthError("Completá tu nombre y tu correo.", "invalid_input");
  }
  if (displayName.length > 40) {
    throw new WebAuthError("El nombre puede tener hasta 40 letras.", "invalid_input");
  }
  if (password.length < 8) {
    throw new WebAuthError("La contraseña necesita al menos 8 caracteres.", "invalid_input");
  }
  const { data, error } = await gateway.auth.signUp({
    email: normalizedEmail,
    password,
    options: { data: { display_name: displayName, sex: profile.sex }, ...(redirectTo ? { emailRedirectTo: redirectTo } : {}) },
  });
  if (error !== null) {
    throw new WebAuthError(
      /already|registered|exists/i.test(error.message) ? "Ese correo ya tiene cuenta. Entrá con tu contraseña." : "No se pudo crear la cuenta. Revisá los datos y probá de nuevo.",
      "sign_up_failed",
    );
  }
  return data.session;
}

export async function signOut(gateway: AuthGateway): Promise<void> {
  const { error } = await gateway.auth.signOut();
  if (error !== null) {
    throw new WebAuthError(
      "No se pudo cerrar sesión.",
      "sign_out_failed",
    );
  }
}

export function subscribeToAuthChanges(
  gateway: AuthGateway,
  listener: (session: Session | null) => void,
): () => void {
  const { data } = gateway.auth.onAuthStateChange((_event, session) => {
    listener(session);
  });
  return () => data.subscription.unsubscribe();
}
