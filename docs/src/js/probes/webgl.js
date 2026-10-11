import { sha256 } from "../hash.js";

/**
 * WebGL fingerprint.
 *
 * Two separate signals:
 *
 *   1. The renderer strings. `UNMASKED_RENDERER_WEBGL` is close to a hardware
 *      model number -- with `WEBGL_debug_renderer_info` it returns the actual
 *      GPU and driver string. This is the single highest-value WebGL signal
 *      and it is why browsers have been progressively locking it down.
 *   2. A rendered image hash. A shaded scene rasterised by the real driver
 *      differs measurably between GPUs and driver versions even when the
 *      renderer strings match.
 *
 * The parameter list is long and every value narrows the population: the
 * number of texture units, the maximum viewport dimensions, the precision
 * formats. Reporting them individually rather than as a hash makes the
 * *why* visible.
 */

const PARAMS = [
  "MAX_TEXTURE_SIZE",
  "MAX_VIEWPORT_DIMS",
  "MAX_RENDERBUFFER_SIZE",
  "MAX_VERTEX_ATTRIBS",
  "MAX_VERTEX_UNIFORM_VECTORS",
  "MAX_VARYING_VECTORS",
  "MAX_FRAGMENT_UNIFORM_VECTORS",
  "MAX_TEXTURE_IMAGE_UNITS",
  "MAX_VERTEX_TEXTURE_IMAGE_UNITS",
  "MAX_COMBINED_TEXTURE_IMAGE_UNITS",
  "MAX_CUBE_MAP_TEXTURE_SIZE",
  "ALIASED_LINE_WIDTH_RANGE",
  "ALIASED_POINT_SIZE_RANGE",
  "RED_BITS",
  "GREEN_BITS",
  "BLUE_BITS",
  "ALPHA_BITS",
  "DEPTH_BITS",
  "STENCIL_BITS",
  "SUBPIXEL_BITS",
  "MAX_SAMPLES",
];

function renderScene(gl) {
  const w = 128;
  const h = 64;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const vertexSrc = `
    attribute vec2 position;
    void main() { gl_Position = vec4(position, 0.0, 1.0); }
  `;
  // A smooth gradient computed per-pixel: forcing the driver's interpolation
  // and precision path.
  const fragmentSrc = `
    precision mediump float;
    void main() {
      vec2 uv = gl_FragCoord.xy / vec2(${w}.0, ${h}.0);
      float d = distance(uv, vec2(0.5, 0.5));
      gl_FragColor = vec4(uv.x, uv.y, sin(d * 12.0) * 0.5 + 0.5, 1.0);
    }
  `;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSrc));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSrc));
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return null;
  }

  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );

  const loc = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  gl.viewport(0, 0, w, h);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  const pixels = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  let acc = 0;
  for (let i = 0; i < pixels.length; i++) acc = (acc * 31 + pixels[i]) >>> 0;
  return acc.toString(16);
}

export const probe = {
  id: "webgl",
  label: "WebGL & GPU",
  family: "rendering",
  bits: 9.5,
  async run() {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");

    if (!gl) {
      return { available: false, note: "No WebGL context." };
    }

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    const readString = (id) => {
      const value = gl.getParameter(id);
      return typeof value === "string" ? value : null;
    };

    const params = {};
    for (const name of PARAMS) {
      const key = gl[name];
      if (key === undefined) continue;
      try {
        const value = gl.getParameter(key);
        params[name] = Array.isArray(value) ? value.slice() : value;
      } catch {
        params[name] = "unreadable";
      }
    }

    let extensions = [];
    try {
      extensions = (gl.getSupportedExtensions() || []).slice().sort();
    } catch {
      extensions = [];
    }

    let hash = null;
    try {
      const checksum = renderScene(gl);
      if (checksum) hash = await sha256(checksum);
    } catch (err) {
      hash = null;
    }

    return {
      available: true,
      vendor: readString(gl.VENDOR),
      renderer: readString(gl.RENDERER),
      version: readString(gl.VERSION),
      shadingLanguageVersion: readString(gl.SHADING_LANGUAGE_VERSION),
      unmaskedVendor: debugInfo ? readString(debugInfo.UNMASKED_VENDOR_WEBGL) : null,
      unmaskedRenderer: debugInfo ? readString(debugInfo.UNMASKED_RENDERER_WEBGL) : null,
      rendererInfoAvailable: Boolean(debugInfo),
      antialias: gl.getContextAttributes()?.antialias ?? null,
      maxAnisotropy: (() => {
        const ext = gl.getExtension("EXT_texture_filter_anisotropic");
        if (!ext) return null;
        try {
          return gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        } catch {
          return null;
        }
      })(),
      extensionCount: extensions.length,
      extensions,
      parameters: params,
      pixelHash: hash,
      note: debugInfo
        ? "Renderer strings are exposed without restriction on this browser."
        : "Renderer strings are masked here; the parameter block carries the signal instead.",
    };
  },
};
