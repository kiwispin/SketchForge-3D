import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SketchForge 3D",
    short_name: "SketchForge",
    description: "Design editable 3D projects in SketchForge.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/assets/sketchforge/sketchforge-logo.png",
        sizes: "1020x1020",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/assets/sketchforge/sketchforge-logo.png",
        sizes: "1020x1020",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
