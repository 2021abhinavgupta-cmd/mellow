import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "mellow — Personal Style AI",
    short_name: "mellow",
    description: "Discover your natural radiance with personalised colour, makeup, hair, and style analysis.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF6F0",
    theme_color: "#FAF6F0",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
