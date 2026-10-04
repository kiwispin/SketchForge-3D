"use client";

import { useEffect } from "react";
import { ASSET_BASE_PATH, BUILD_ID } from "@/lib/basePath";

const SHELL_CACHED_KEY = "sketchforge.pwaShellCached";

export function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    // The first visit loads the editor before the service worker controls the
    // page, so its scripts are not cached yet. Reload once when the worker takes
    // over so the shell is cached and the app opens offline next time.
    try {
      if (!navigator.serviceWorker.controller && !sessionStorage.getItem(SHELL_CACHED_KEY)) {
        sessionStorage.setItem(SHELL_CACHED_KEY, "true");
        navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
      }
    } catch {
      // sessionStorage can be unavailable (privacy modes); skip the one-off reload.
    }

    // The build id in the script URL makes every deploy register a new worker
    // with its own cache (see public/sw.js).
    void navigator.serviceWorker
      .register(`${ASSET_BASE_PATH}/sw.js?build=${encodeURIComponent(BUILD_ID)}`, { scope: `${ASSET_BASE_PATH}/` })
      .catch(() => {
        // The editor remains fully usable online if registration is unavailable.
      });
  }, []);

  return null;
}
