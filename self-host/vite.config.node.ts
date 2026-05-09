// Self-host Vite config: Node SSR build instead of Cloudflare Workers.
// This file is swapped in by self-host/apply-patch.sh on the server.
// Do not edit by hand in the editor — the editor uses the original vite.config.ts.

import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      target: "node-server",
      customViteReactPlugin: true,
    }),
    viteReact(),
  ],
  server: { port: 3000, host: "0.0.0.0" },
});
