import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const src = path.resolve(root, "client", "public", "icon.svg");
const outDir = path.resolve(root, "client", "public");

const sizes = [192, 256, 384, 512];
const appleSizes = [180];

for (const s of [...sizes, ...appleSizes]) {
  await sharp(src).resize(s, s).png().toFile(path.join(outDir, `pwa-${s}.png`));
}

const maskable = await sharp(src).resize(512, 512).png().toBuffer();
await writeFile(path.join(outDir, "pwa-maskable-512.png"), maskable);

const ico = await sharp(src).resize(256, 256).png().toBuffer();
await writeFile(path.join(outDir, "favicon.ico"), ico);

console.log("PWA icons generated:", [...sizes, ...appleSizes], "+ maskable + favicon");
