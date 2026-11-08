import type { MetadataRoute } from "next";

/** Installable web app (PWA): opens straight into the workspace. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DecisionGuard",
    short_name: "DecisionGuard",
    description: "Analyse des risques avant décision · Risk analysis before you decide",
    start_url: "/fr/app",
    scope: "/",
    display: "standalone",
    background_color: "#060a1a",
    theme_color: "#060a1a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
