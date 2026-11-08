import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [
    react(),
    {
      name: "forma-offline-shell",
      apply: "build",
      async generateBundle(_options, bundle) {
        const assets = Object.keys(bundle).filter((file) => file.startsWith("assets/")).sort();
        const version = createHash("sha256").update(assets.join("\n")).digest("hex").slice(0, 12);
        const worker = await readFile(new URL("./public/sw.js", import.meta.url), "utf8");
        this.emitFile({
          type: "asset",
          fileName: "sw.js",
          source: worker.replace('"forma-shell-v7"', JSON.stringify(`forma-shell-v7-${version}`))
            .replace("/* build assets */", assets.map((file) => JSON.stringify(`/${file}`)).join(", ")),
        });
      },
    },
  ],
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
  },
});
