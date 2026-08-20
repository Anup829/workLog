import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin";
import { vitePluginSsr } from "@lovable.dev/vite-tanstack-config";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    tanstackStart(),
    vitePluginSsr(),
    tailwindcss(),
    react(),
    viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
  ],
  ssr: { noExternal: ["@supabase/supabase-js"] },
});
