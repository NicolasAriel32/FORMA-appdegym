export type ApiRuntimeEnv = {
  VITE_FORMA_API_URL?: string;
};

export type ApiUser = {
  id: string;
  email: string | null;
  role: "member" | "trainer";
  createdAt: string;
};

export type ApiExercise = {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: "published";
  createdAt: string;
  publishedAt: string | null;
  retiredAt: null;
  movementPattern: string;
  targetMuscles: string[];
  secondaryMuscles: string[];
  instructions: string;
  commonMistakes: string[];
  safetyNotes: string[];
  equipment: string;
  difficulty: "beginner" | "intermediate" | "advanced";
};

export type ApiRoutineExercise = {
  id: string;
  exerciseId: string;
  position: number;
  targetSets: number;
  repetitionsMin: number;
  repetitionsMax: number;
  restSeconds: number;
  status: "active" | "removed";
};

export type ApiRoutine = {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  status: "active" | "archived";
  revision: number;
  createdAt: string;
  updatedAt: string;
  exercises: ApiRoutineExercise[];
};

export type RoutineInput = {
  name: string;
  description: string;
  exerciseIds: string[];
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

export async function fetchPublishedExercises({
  apiBaseUrl,
  accessToken,
  fetchImpl = fetch,
}: {
  apiBaseUrl: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<ApiExercise[]> {
  const body = await requestJson({
    apiBaseUrl,
    accessToken,
    path: "/exercises",
    fetchImpl,
  });
  if (!isRecord(body) || !Array.isArray(body.exercises)) {
    throw new ApiClientError("El catálogo devolvió una respuesta inválida.", "invalid_response");
  }
  return body.exercises.map(parseApiExercise);
}

export async function fetchRoutines({
  apiBaseUrl,
  accessToken,
  fetchImpl = fetch,
}: {
  apiBaseUrl: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<ApiRoutine[]> {
  const body = await requestJson({
    apiBaseUrl,
    accessToken,
    path: "/routines",
    fetchImpl,
  });
  if (!isRecord(body) || !Array.isArray(body.routines)) {
    throw new ApiClientError("Las rutinas devolvieron una respuesta inválida.", "invalid_response");
  }
  return body.routines.map(parseApiRoutine);
}

export async function createRoutine({
  apiBaseUrl,
  accessToken,
  input,
  fetchImpl = fetch,
}: {
  apiBaseUrl: string;
  accessToken: string;
  input: RoutineInput;
  fetchImpl?: typeof fetch;
}): Promise<ApiRoutine> {
  return parseApiRoutine(await requestJson({
    apiBaseUrl,
    accessToken,
    path: "/routines",
    method: "POST",
    body: input,
    fetchImpl,
  }));
}

export async function updateRoutine({
  apiBaseUrl,
  accessToken,
  routineId,
  input,
  fetchImpl = fetch,
}: {
  apiBaseUrl: string;
  accessToken: string;
  routineId: string;
  input: RoutineInput;
  fetchImpl?: typeof fetch;
}): Promise<ApiRoutine> {
  return parseApiRoutine(await requestJson({
    apiBaseUrl,
    accessToken,
    path: `/routines/${encodeURIComponent(routineId)}`,
    method: "PUT",
    body: input,
    fetchImpl,
  }));
}

async function requestJson({
  apiBaseUrl,
  accessToken,
  path,
  method = "GET",
  body,
  fetchImpl,
}: {
  apiBaseUrl: string;
  accessToken: string;
  path: string;
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  fetchImpl: typeof fetch;
}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(`${apiBaseUrl}${path}`, {
      method,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${accessToken}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store",
    });
  } catch {
    throw new ApiClientError("No se pudo conectar con el API de FORMA.", "unavailable");
  }
  if (response.status === 401) throw new ApiClientError("La sesión ya no es válida.", "unauthenticated");
  if (response.status === 403) throw new ApiClientError("El API rechazó el acceso.", "forbidden");
  if (!response.ok) throw new ApiClientError("El API no pudo completar la solicitud.", "failed");
  try {
    return await response.json();
  } catch {
    throw new ApiClientError("El API devolvió una respuesta inválida.", "invalid_response");
  }
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

function parseApiExercise(value: unknown): ApiExercise {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.slug !== "string" || typeof value.name !== "string" || typeof value.description !== "string" || value.status !== "published" || typeof value.createdAt !== "string" || (value.publishedAt !== null && typeof value.publishedAt !== "string") || value.retiredAt !== null || typeof value.movementPattern !== "string" || !isStringArray(value.targetMuscles) || !isStringArray(value.secondaryMuscles) || typeof value.instructions !== "string" || !isStringArray(value.commonMistakes) || !isStringArray(value.safetyNotes) || typeof value.equipment !== "string" || (value.difficulty !== "beginner" && value.difficulty !== "intermediate" && value.difficulty !== "advanced")) {
    throw new ApiClientError("El catálogo devolvió un ejercicio inválido.", "invalid_response");
  }
  return value as unknown as ApiExercise;
}

function parseApiRoutine(value: unknown): ApiRoutine {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.ownerId !== "string" || typeof value.name !== "string" || typeof value.description !== "string" || (value.status !== "active" && value.status !== "archived") || typeof value.revision !== "number" || !Number.isInteger(value.revision) || typeof value.createdAt !== "string" || typeof value.updatedAt !== "string" || !Array.isArray(value.exercises)) {
    throw new ApiClientError("Las rutinas devolvieron una rutina inválida.", "invalid_response");
  }
  const exercises = value.exercises.map(parseApiRoutineExercise);
  return { ...value, exercises } as unknown as ApiRoutine;
}

function parseApiRoutineExercise(value: unknown): ApiRoutineExercise {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.exerciseId !== "string" || typeof value.position !== "number" || !Number.isInteger(value.position) || typeof value.targetSets !== "number" || !Number.isInteger(value.targetSets) || typeof value.repetitionsMin !== "number" || !Number.isInteger(value.repetitionsMin) || typeof value.repetitionsMax !== "number" || !Number.isInteger(value.repetitionsMax) || typeof value.restSeconds !== "number" || !Number.isInteger(value.restSeconds) || (value.status !== "active" && value.status !== "removed")) {
    throw new ApiClientError("Las rutinas devolvieron un ejercicio inválido.", "invalid_response");
  }
  return value as unknown as ApiRoutineExercise;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
