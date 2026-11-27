import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
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
        const media = [...worker.matchAll(/"(\/media\/exercises\/[a-z0-9-]+\/)repetition-pilot\.mp4"/g)]
          .flatMap((match) => [`${match[1]}repetition-pilot.mp4`, `${match[1]}poster.webp`]);
        media.push(...[...worker.matchAll(/"(\/media\/exercises\/[a-z0-9-]+\/photo\.webp)"/g)].map((match) => match[1]!));
        const mediaSizes = await Promise.all(media.map(async (file) => (await stat(new URL(`./public${file}`, import.meta.url))).size));
        const mediaBytes = mediaSizes.reduce((total, size) => total + size, 0);
        this.emitFile({
          type: "asset",
          fileName: "sw.js",
          source: worker.replace(/"forma-shell-v[0-9]+"/, (cache) => JSON.stringify(`${JSON.parse(cache)}-${version}`))
            .replace("/* build assets */", assets.map((file) => JSON.stringify(`/${file}`)).join(", "))
            .replace('"/* media bytes */"', String(mediaBytes)),
        });
      },
    },
  ],
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
  },
});
