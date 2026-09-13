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
    injectRegister: "auto",
    includeAssets: ["favicon.ico", "icon.svg", "pwa-180.png"],
    manifest: {
      name: "Lucepress Sarl — Gestion commerciale",
      short_name: "Lucepress",
      description: "Devis, factures, clients et pilotage commercial pour Lucepress Sarl.",
      lang: "fr",
      dir: "ltr",
      categories: ["business", "finance", "productivity"],
      display: "standalone",
      orientation: "any",
      start_url: "/",
      scope: "/",
      background_color: "#113b35",
      theme_color: "#113b35",
      icons: [
        { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
        { src: "/pwa-256.png", sizes: "256x256", type: "image/png" },
        { src: "/pwa-384.png", sizes: "384x384", type: "image/png" },
        { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
        { src: "/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    workbox: {
      globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],
      navigateFallback: "/index.html",
      navigateFallbackDenylist: [/^\/api\//],
      runtimeCaching: [
        {
          urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
          handler: "NetworkFirst",
          options: {
            cacheName: "api-runtime",
            networkTimeoutSeconds: 8,
            expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
          },
        },
        {
          urlPattern: ({ request }) => request.destination === "font",
          handler: "CacheFirst",
          options: {
            cacheName: "fonts-runtime",
            expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: ({ request }) =>
            ["style", "script", "image", "worker"].includes(request.destination),
          handler: "StaleWhileRevalidate",
          options: {
            cacheName: "assets-runtime",
            expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },
    devOptions: {
      enabled: false,
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
            "@radix-ui/react-tooltip",
            "@radix-ui/react-accordion",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-avatar",
            "@radix-ui/react-label",
            "@radix-ui/react-separator",
            "@radix-ui/react-switch",
            "@radix-ui/react-slot",
          ],
          charts: ["recharts"],
          pdf: ["jspdf", "html2canvas"],
          motion: ["framer-motion"],
          data: ["@tanstack/react-query", "@trpc/client", "@trpc/react-query"],
          forms: ["react-hook-form", "@hookform/resolvers", "zod"],
          icons: ["lucide-react"],
          datetime: ["date-fns", "react-day-picker"],
          overlay: ["cmdk", "sonner", "vaul", "next-themes"],
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
