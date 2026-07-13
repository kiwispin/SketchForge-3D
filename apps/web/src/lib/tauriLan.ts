export type LanSession = {
  code: string;
  hostName: string;
  serviceUrl: string;
};

type TauriInternals = {
  invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
};

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: TauriInternals;
};

export function isTauriDesktop() {
  return typeof window !== "undefined" && Boolean((window as TauriWindow).__TAURI_INTERNALS__);
}

export async function discoverLanSessions(): Promise<LanSession[]> {
  if (!isTauriDesktop()) return [];
  return (window as TauriWindow).__TAURI_INTERNALS__!.invoke("discover_sessions") as Promise<LanSession[]>;
}
