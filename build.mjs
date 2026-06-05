import { build } from "esbuild";
import { readdirSync, mkdirSync } from "fs";
import { join } from "path";

const SRC = "js";
const OUT = "js/min";

// Arquivos a minificar (apenas os customizados — three/vanta já são minificados)
const SKIP = new Set([
  "three.r134.min.js",
  "vanta.clouds2.min.js",
]);

mkdirSync(OUT, { recursive: true });

const files = readdirSync(SRC)
  .filter(f => f.endsWith(".js") && !SKIP.has(f))
  .map(f => join(SRC, f));

await build({
  entryPoints: files,
  outdir: OUT,
  minify: true,
  bundle: false,      // não agrupa — cada arquivo é independente
  platform: "browser",
  target: ["es2017"],
  logLevel: "info",
});

console.log(`\n✓ Minificados ${files.length} arquivos → ${OUT}/`);
