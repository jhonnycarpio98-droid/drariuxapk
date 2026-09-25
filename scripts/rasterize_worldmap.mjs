// Rasteriza el SVG del mapa hex a PNG (usa sharp del proyecto app).
import sharp from 'sharp';
const svg = process.argv[2];
const png = process.argv[3];
const w = parseInt(process.argv[4] || '1400', 10);
await sharp(svg, { density: 200 }).resize({ width: w }).png().toFile(png);
console.log('PNG ->', png);
