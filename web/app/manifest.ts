import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Serruchito Finanzas",
    short_name: "Serruchito",
    description: "Dashboard unificado de inversiones: Cocos Capital, Balanz, Interactive Brokers e InvertirOnline.",
    start_url: "/",
    display: "standalone",
    background_color: "#f9f9f7",
    theme_color: "#b5502e",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
