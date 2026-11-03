export type ApiRuntimeEnv = {
  VITE_FORMA_API_URL?: string;
};

export type ApiUser = {
  id: string;
  email: string | null;
  role: "member" | "trainer";
  createdAt: string;
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: "unavailable" | "unauthenticated" | "forbidden" | "failed" | "invalid_response",
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export function readApiBaseUrl(
  environment: ApiRuntimeEnv,
): string | undefined {
  const value = environment.VITE_FORMA_API_URL?.trim();
  if (value === undefined || value.length === 0) {
    return undefined;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return undefined;
    }
    return value.replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

export function createConfiguredBrowserApiBaseUrl(): string | undefined {
  const environment = (import.meta as ImportMeta & { env?: ApiRuntimeEnv }).env ?? {};
  return readApiBaseUrl(environment);
}

export async function fetchCurrentUser({
  apiBaseUrl,
  accessToken,
  fetchImpl = fetch,
}: {
  apiBaseUrl: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<ApiUser> {
  let response: Response;
  try {
    response = await fetchImpl(`${apiBaseUrl}/me`, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiClientError(
      "No se pudo conectar con el API de FORMA.",
      "unavailable",
    );
  }

  if (response.status === 401) {
    throw new ApiClientError("La sesión ya no es válida.", "unauthenticated");
  }
  if (response.status === 403) {
    throw new ApiClientError("El API rechazó el acceso.", "forbidden");
  }
  if (!response.ok) {
    throw new ApiClientError("El API no pudo completar la solicitud.", "failed");
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiClientError(
      "El API devolvió una respuesta inválida.",
      "invalid_response",
    );
  }
  return parseApiUser(body);
}

function parseApiUser(value: unknown): ApiUser {
  if (!isRecord(value)) {
    throw new ApiClientError(
      "El API devolvió una identidad inválida.",
      "invalid_response",
    );
  }
  const { id, email, role, createdAt } = value;
  if (
    typeof id !== "string" ||
    (email !== null && typeof email !== "string") ||
    (role !== "member" && role !== "trainer") ||
    typeof createdAt !== "string"
  ) {
    throw new ApiClientError(
      "El API devolvió una identidad inválida.",
      "invalid_response",
    );
  }
  return { id, email, role, createdAt };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
