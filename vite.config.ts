// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      watch: {
        // Force frequent polling and ignore node_modules for better detection
        usePolling: true,
        interval: 100,
        ignored: ["**/node_modules/**", "**/.git/**"],
      },
    },
    plugins: [
      {
        name: "restart-on-major-change",
        handleHotUpdate({ file, server }) {
          if (file.includes("parceiro.tsx")) {
            // Trigger a full restart if the file is large or manually requested
            console.log(`[vite] Major change detected in ${file}, clearing cache...`);
            server.ws.send({
              type: 'full-reload',
              path: '*'
            });
          }
        },
      },
    ],
  },
});
