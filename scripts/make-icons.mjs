/**
 * Generates the app icons (PWA, favicon, Apple touch icon) from the « M » of
 * the MaelEnglish logo, in the logo blue, redrawn as a vector (points measured on
 * public/images/maelenglish-logo.png) + the logo's coral bar and toggle (red).
 *   node scripts/make-icons.mjs
 */
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const CORAL = "#ff5757";
const BLUE = "#364fab"; // « English » blue of the logo — colour of the M
const W = 107, H = 88.4;
const M = [[0, 0], [28.6, 0], [54.5, 32.4], [80, 0], [107, 0], [107, H], [73.8, H], [73.8, 55.6], [62.6, 70.8], [46.4, 70.8], [33.6, 55.6], [33.6, H], [0, H]];

function svg(size, markRatio, background = "#ffffff") {
  const mW = size * markRatio, k = mW / W, mH = H * k;
  const barH = mW * 0.17, gap = mW * 0.1;
  const top = (size - (mH + gap + barH)) / 2, left = (size - mW) / 2;
  const pillW = mW * 0.36, barW = mW - pillW - barH * 0.35, y = top + mH + gap, r = barH / 2;
  const d = "M" + M.map(([x, yy]) => `${(left + x * k).toFixed(2)},${(top + yy * k).toFixed(2)}`).join("L") + "Z";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${background ? `<rect width="100%" height="100%" fill="${background}"/>` : ""}
  <path d="${d}" fill="${BLUE}"/>
  <rect x="${left.toFixed(2)}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="${barH.toFixed(2)}" rx="${r.toFixed(2)}" fill="${CORAL}"/>
  <rect x="${(left + mW - pillW).toFixed(2)}" y="${y.toFixed(2)}" width="${pillW.toFixed(2)}" height="${barH.toFixed(2)}" rx="${r.toFixed(2)}" fill="${CORAL}"/>
  <circle cx="${(left + mW - r).toFixed(2)}" cy="${(y + r).toFixed(2)}" r="${(r * 0.62).toFixed(2)}" fill="#ffffff"/>
</svg>`;
}

const png = (s, out) => sharp(Buffer.from(s)).png({ compressionLevel: 9 }).toFile(out);

(async () => {
  await png(svg(512, 0.62), "public/icons/icon-512.png");
  await png(svg(192, 0.62), "public/icons/icon-192.png");
  await png(svg(512, 0.46), "public/icons/maskable-512.png"); // safe zone for Android masks
  await png(svg(512, 0.62), "src/app/icon.png");
  await png(svg(180, 0.6), "src/app/apple-icon.png");
  writeFileSync("public/icons/icon.svg", svg(512, 0.62));
  console.log("icons generated");
})();
