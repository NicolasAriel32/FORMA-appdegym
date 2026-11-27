// Habla con el service worker para bajar todos los videos de ejercicios de una vez.

export type MediaStatus = { cached: number; total: number; exercises: number; savedExercises: number; bytes: number };
export type MediaDownloadProgress = { done: number; total: number };
export type MediaDownloadResult = MediaDownloadProgress & { failed: number };

type WorkerMessage =
  | ({ type: "status" } & MediaStatus)
  | ({ type: "progress" } & MediaDownloadProgress)
  | ({ type: "done" } & MediaDownloadResult);

const WORKER_TIMEOUT_MS = 4000;

/** Devuelve el service worker activo, o null si la app corre sin modo offline (por ejemplo, en desarrollo). */
async function activeWorker(): Promise<ServiceWorker | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if ((await navigator.serviceWorker.getRegistration()) === undefined) return null;
  const ready = navigator.serviceWorker.ready.then((registration) => registration.active);
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), WORKER_TIMEOUT_MS));
  return Promise.race([ready, timeout]);
}

export async function readMediaStatus(): Promise<MediaStatus | null> {
  const worker = await activeWorker();
  if (worker === null) return null;
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); resolve(null); }, WORKER_TIMEOUT_MS);
    channel.port1.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (event.data.type !== "status") return;
      clearTimeout(timer);
      channel.port1.close();
      const { type: _type, ...status } = event.data;
      resolve(status);
    };
    worker.postMessage({ type: "media-status" }, [channel.port2]);
  });
}

export async function downloadExerciseMedia(
  onProgress: (progress: MediaDownloadProgress) => void,
): Promise<MediaDownloadResult> {
  const worker = await activeWorker();
  if (worker === null) throw new Error("offline_unavailable");
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === "progress") onProgress({ done: message.done, total: message.total });
      if (message.type === "done") {
        channel.port1.close();
        resolve({ done: message.done, total: message.total, failed: message.failed });
      }
    };
    worker.postMessage({ type: "download-media" }, [channel.port2]);
  });
}

type NetworkInformationLike = { type?: string; saveData?: boolean };

/** true cuando el navegador avisa que se usan datos móviles o el ahorro de datos está activo. */
export function isOnMeteredConnection(): boolean {
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  return connection?.type === "cellular" || connection?.saveData === true;
}

export function formatMegabytes(bytes: number): string {
  return `${(bytes / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} MB`;
}
