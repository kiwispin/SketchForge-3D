"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    if (!navigator.serviceWorker.controller && !sessionStorage.getItem("sketchforge.pwaShellCached")) {
      sessionStorage.setItem("sketchforge.pwaShellCached", "true");
      navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
    }

    void navigator.serviceWorker.register("./sw.js").catch(() => {
      // The editor remains fully usable online if registration is unavailable.
    });
  }, []);

  return null;
}
