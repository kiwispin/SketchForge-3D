import type { NextConfig } from "next";
import path from "node:path";

const isStaticExport = process.env.STATIC_EXPORT === "true";
const isDockerBuild = process.env.SKETCHFORGE_DOCKER_BUILD === "true";
// GitHub Pages serves a project site from /<repository>/. The Pages workflow
// sets GITHUB_PAGES=true and PAGES_BASE_PATH=/<repository>;
// scripts/verify-static-worker-assets.mjs applies the same default.
const isGitHubPages = isStaticExport && process.env.GITHUB_PAGES === "true";
const basePath = isGitHubPages ? (process.env.PAGES_BASE_PATH ?? "/SketchForge-3D").replace(/\/+$/, "") : "";
// One id per build, shared by every compiler that loads this config (they
// inherit process.env), so the service worker can version its cache by it.
process.env.SKETCHFORGE_BUILD_ID ||= process.env.GITHUB_SHA?.slice(0, 12) || Date.now().toString(36);
const buildId = process.env.SKETCHFORGE_BUILD_ID;
const extraAllowedDevOrigins = (process.env.SKETCHFORGE_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd()),
  devIndicators: false,
  // Keep the live development compiler isolated from `next build`. Sharing
  // `.next` lets a production verification build invalidate chunks used by a
  // running dev server, which also breaks API routes such as project snapshots.
  distDir: isStaticExport ? ".next-export" : process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  allowedDevOrigins: ["localhost", "127.0.0.1", ...extraAllowedDevOrigins],
  env: {
    NEXT_PUBLIC_STATIC_EXPORT: isStaticExport ? "true" : "false",
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  images: {
    unoptimized: true
  },
  // brepjs (loaded lazily by the STEP exporter) ships an auto-init helper that
  // tries optional kernel backends via guarded `import().catch()`. We only install
  // and use occt-wasm, so silence the resolution warnings for the backends we omit.
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "brepkit-wasm": false,
      "brepjs-opencascade": false,
    };
    return config;
  },
  ...(isStaticExport
    ? {
        output: "export" as const,
        trailingSlash: true,
        // Upstream's root-relative /_next/ asset prefix is kept (CAD worker
        // chunks need it); on Pages it simply gains the base path.
        ...(basePath ? { basePath } : {}),
      }
    : isDockerBuild
      ? { output: "standalone" as const }
      : {}),
};

export default nextConfig;
