// Generates the extension icons (accent rounded square with a bar-chart glyph)
// as PNGs without third-party dependencies. Run: node scripts/generate-icons.js
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const SIZES = [16, 32, 48, 128];
const ACCENT = [37, 99, 235]; // #2563EB — matches --kvf-color-accent
const WHITE = [255, 255, 255];
const SUPERSAMPLE = 4;

// Shapes in a 0..1 coordinate space.
const BACKGROUND = { x: 0, y: 0, w: 1, h: 1, r: 0.22 };
const BARS = [
  { x: 0.22, y: 0.56, w: 0.15, h: 0.22, r: 0.04 },
  { x: 0.425, y: 0.4, w: 0.15, h: 0.38, r: 0.04 },
  { x: 0.63, y: 0.22, w: 0.15, h: 0.56, r: 0.04 },
];

function insideRoundedRect(px, py, { x, y, w, h, r }) {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

function renderPixels(size) {
  const data = Buffer.alloc(size * size * 4);
  const samples = SUPERSAMPLE * SUPERSAMPLE;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bg = 0;
      let bar = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const px = (x + (sx + 0.5) / SUPERSAMPLE) / size;
          const py = (y + (sy + 0.5) / SUPERSAMPLE) / size;
          if (!insideRoundedRect(px, py, BACKGROUND)) continue;
          bg++;
          if (BARS.some((b) => insideRoundedRect(px, py, b))) bar++;
        }
      }
      const i = (y * size + x) * 4;
      const t = bg ? bar / bg : 0;
      for (let c = 0; c < 3; c++) data[i + c] = Math.round(ACCENT[c] * (1 - t) + WHITE[c] * t);
      data[i + 3] = Math.round((bg / samples) * 255);
    }
  }
  return data;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, payload) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(payload.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), payload]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const rows = [];
  for (let y = 0; y < size; y++) {
    rows.push(Buffer.from([0]), rgba.subarray(y * size * 4, (y + 1) * size * 4));
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = fileURLToPath(new URL('../extension/icons/', import.meta.url));
for (const size of SIZES) {
  writeFileSync(`${outDir}icon-${size}.png`, encodePng(size, renderPixels(size)));
}
console.log(`Generated ${SIZES.length} icons in ${outDir}`);
