import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const plugins = [
  react(),
  tailwindcss(),
  jsxLocPlugin(),
  VitePWA({
    registerType: "autoUpdate",
    includeAssets: ["lucepress-emblem.png"],
    manifest: {
      name: "Lucepres — Devis & Factures",
      short_name: "Lucepres",
      description: "Gestion commerciale BTP, hydraulique et services — devis, factures, chantiers",
      theme_color: "#113b35",
      background_color: "#f6faf8",
      display: "standalone",
      icons: [{ src: "lucepress-emblem.png", sizes: "512x512", type: "image/png" }],
    },
    workbox: {
      globPatterns: ["**/*.{js,css,html,woff2,png,svg}"],
      runtimeCaching: [
        { urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i, handler: "CacheFirst", options: { cacheName: "google-fonts-cache", expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } } },
        { urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i, handler: "CacheFirst", options: { cacheName: "gfonts-cache", expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } } },
        { urlPattern: /\/api\/trpc\/.*/i, handler: "NetworkFirst", options: { cacheName: "api-cache", networkTimeoutSeconds: 3, expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 } } },
      ],
    },
  }),
];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "wouter"],
          radix: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-popover",
          ],
          charts: ["recharts"],
          pdf: ["jspdf", "html2canvas"],
          motion: ["framer-motion"],
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
