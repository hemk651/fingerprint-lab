import { sha256 } from "../hash.js";

/**
 * Canvas rendering fingerprint.
 *
 * The page is allowed to draw. What it draws depends on the font rasteriser,
 * the anti-aliasing path, the GPU, the sub-pixel layout the OS is using and
 * the colour management settings. Identical text produces a slightly
 * different bitmap on different machines, and that bitmap hashes to a stable
 * per-machine value.
 *
 * Deliberately blocked by Brave, Firefox's resistFingerprinting and Safari's
 * anti-fingerprinting. When blocked the hash collapses to a constant -- that
 * absence is itself worth reporting.
 */

const WIDTH = 300;
const HEIGHT = 90;

function paint(ctx) {
  // Translucent gradient: forces the compositing path into the hash.
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, "#ff6600");
  gradient.addColorStop(0.5, "#006699");
  gradient.addColorStop(1, "#00cc66");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Text with an emoji: exercises glyph shaping beyond the BMP.
  ctx.textBaseline = "top";
  ctx.font = '16px "Arial"';
  ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
  ctx.fillText("Cwm fjord bank glyphs vext quiz \u{1F600}", 4, 4);

  // Emoji at a second size: catches emoji font substitution differences.
  ctx.font = '12px "Times New Roman"';
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillText("\u{1F600}\u{1F680}\u{1F44D}", 4, 26);

  // Geometry: curves and strokes round differently across rasterisers.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(240, 30, 22, 0, Math.PI * 1.6);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(4, 60);
  ctx.bezierCurveTo(40, 20, 120, 80, 160, 50);
  ctx.stroke();

  // Global composite operation: blending differences land here.
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "rgba(0, 128, 255, 0.5)";
  ctx.fillRect(180, 55, 100, 25);

  ctx.globalCompositeOperation = "source-over";

  // Shadow rendering: a well-known fingerprint amplifier.
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = "#fff";
  ctx.fillRect(4, 70, 120, 10);
}

function readBack(ctx) {
  // A raw pixel readback catches colour-space conversion and dithering that
  // the encoded PNG would otherwise paper over.
  const data = ctx.getImageData(0, 0, 24, 4).data;
  let acc = 0;
  for (let i = 0; i < data.length; i++) acc = (acc * 31 + data[i]) >>> 0;
  return { checksum: acc.toString(16), firstPixels: Array.from(data.slice(0, 8)) };
}

export const probe = {
  id: "canvas",
  label: "Canvas 2D rendering",
  family: "rendering",
  bits: 7.0,
  async run() {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return { available: false, note: "2D canvas context unavailable." };
    }

    paint(ctx);

    let dataUrl;
    try {
      dataUrl = canvas.toDataURL();
    } catch (err) {
      return { available: false, note: `toDataURL refused: ${err.message}` };
    }

    const hash = await sha256(dataUrl);
    const checksum = readBack(ctx);

    return {
      available: true,
      dimensions: `${WIDTH}x${HEIGHT}`,
      dataUrlBytes: dataUrl.length,
      hash,
      ...checksum,
    };
  },
};
