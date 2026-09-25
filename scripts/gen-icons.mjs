// Genera las fuentes de icono (icon / splash / logo) a partir del logo
// vectorial de marca, sin depender de ImageGen (pipeline vector->raster,
// explícitamente contemplado por el plan). Nombres en minúsculas porque son los
// que reconoce @capacitor/assets. Ejecuta: node scripts/gen-icons.mjs
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const assets = path.join(root, "assets");
mkdirSync(assets, { recursive: true });

const svg = readFileSync(path.join(root, "src/assets/logo.svg"), "utf8");
const SIZE = 1024;
const EMBLEM = 896; // alto emblema para app-icon

async function emblemTransparent(w) {
  return sharp(Buffer.from(svg))
    .resize(w, w, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

function darkBg() {
  // degradado radial cálido coherente con el tema
  const svgBg = `<svg width="${SIZE}" height="${SIZE}">
    <defs><radialGradient id="r" cx="50%" cy="35%" r="80%">
      <stop offset="0" stop-color="#2a2117"/>
      <stop offset="1" stop-color="#140f0a"/>
    </radialGradient></defs>
    <rect width="100%" height="100%" fill="url(#r)"/>
  </svg>`;
  return sharp(Buffer.from(svgBg)).png().toBuffer();
}

// icon.png: fondo lleno + emblema centrado (app launcher)
await sharp(await darkBg())
  .composite([{ input: await emblemTransparent(EMBLEM), gravity: "center" }])
  .resize(SIZE, SIZE)
  .png()
  .toFile(path.join(assets, "icon.png"));

// logo.png: misma marca, servible como logo de cabecera / splash alternativo
await sharp(await darkBg())
  .composite([{ input: await emblemTransparent(EMBLEM), gravity: "center" }])
  .resize(SIZE, SIZE)
  .png()
  .toFile(path.join(assets, "logo.png"));

// splash.png: emblema sobre fondo transparente (Capacitor lo centra)
await sharp(await emblemTransparent(768))
  .png()
  .toFile(path.join(assets, "splash.png"));

console.log("fuentes de icono generadas en assets/: icon.png, logo.png, splash.png");
