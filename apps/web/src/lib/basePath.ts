// Deployment paths baked in at build time by next.config.ts.
//
// ASSET_BASE_PATH is empty unless the static export is deployed under a
// sub-path (GitHub Pages serves the app from /<repository>/). Prefix every
// root-relative URL for files in public/ (and app routes) with it.
export const ASSET_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// The app's own root URL, for history.replaceState and links back home.
export const APP_ROOT_PATH = `${ASSET_BASE_PATH}/`;

// Identifies one build; the service worker names its cache after it so each
// deploy starts from a fresh cache instead of serving stale assets.
export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
