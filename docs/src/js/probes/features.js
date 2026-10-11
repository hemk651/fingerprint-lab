/**
 * API surface.
 *
 * A boolean vector over a few hundred browser APIs. This is the modern
 * fingerprint: each entry is worth a fraction of a bit, but the vector as a
 * whole encodes browser *version* very precisely, because APIs are added and
 * removed on a release cadence. Two pages that disagree on a single obscure
 * API are on different builds, which is a stronger version signal than the
 * User-Agent string (which browsers now freeze to reduce entropy).
 *
 * Grouped so the UI can show *why* a category is there rather than a wall of
 * property names.
 */

const GROUPS = {
  "navigator": [
    "bluetooth", "clipboard", "credentials", "geolocation", "gpu", "hid",
    "keyboard", "locks", "mediaDevices", "mediaSession", "mimeTypes",
    "plugins", "presentation", "serial", "serviceWorker", "storage",
    "usb", "userActivation", "userAgentData", "wakeLock", "webdriver",
    "xr", "msMaxTouchPoints", "pdfViewerEnabled", "sendBeacon", "vibrate",
    "share", "canShare",
  ],
  "window": [
    "AbortController", "AbortSignal", "BalanceStream", "Bluetooth",
    "BroadcastChannel", "ClipboardItem", "CompressionStream",
    "DecompressionStream", "EyeDropper", "FileSystemHandle", "FontFace",
    "FutureTypeface", "GPU", "IdleDetector", "ImageDecoder", "IntersectionObserver",
    "LargestContentfulPaint", "MediaSession", "MutationObserver", "Notification",
    "OffscreenCanvas", "PaymentRequest", "PerformanceObserver", "PeriodicSyncManager",
    "PermissionsPolicy", "PictureInPictureWindow", "PushManager",
    "ReadableStream", "ReportingObserver", "ResizeObserver", "RTCPeerConnection",
    "Sanitizer", "Scheduler", "ShowDirectoryPicker", "SpeechRecognition",
    "StorageManager", "TrustedHTML", "ViewTransition", "VisualViewport",
    "WebAssembly", "WebTransport", "Worker", "Worklet", "XMLHttpRequest",
    "getScreenDetails", "queryLocalFonts", "launchQueue", "onappinstalled",
  ],
  "document": [
    "crossOriginIsolated", "hasFocus", "hasStorageAccess", "pictureInPictureEnabled",
    "pointerLockElement", "visibilityState", "startViewTransition", "fonts",
    "adoptedStyleSheets", "fullscreenEnabled", "timeline", "caretPositionFromPoint",
    "onbeforetoggle",
  ],
  "css": [
    "registerProperty", "supports", "CSSLayerBlockRule", "CSSNestingRule",
    "CSSStyleRule", "CSSScopeRule", "CSSStartingStyleRule", "CSSPositionTryRule",
    "attr", "anchor-scope", "container-type", "text-wrap", "color-mix",
  ],
  "storage": [
    "indexedDB", "localStorage", "sessionStorage", "caches", "CookieStore",
    "storageBuckets", "openDatabase",
  ],
};

/** CSS feature probes -- `CSS.supports` answers without a stylesheet. */
const CSS_FEATURES = [
  "selector(:has(a))",
  "selector(:is(a, b))",
  "selector(:where(a))",
  "selector(::backdrop)",
  "selector(&:hover)",
  "property(--x)",
  "position: sticky",
  "display: grid",
  "display: flex",
  "backdrop-filter: blur(1px)",
  "color-mix(in srgb, red, blue)",
  "width: 1dvh",
  "overscroll-behavior: contain",
  "text-wrap: balance",
  "scrollbar-width: thin",
  "aspect-ratio: 1 / 2",
];

export const probe = {
  id: "features",
  label: "API & feature surface",
  family: "software",
  bits: 4.5,
  async run() {
    const vectors = {};

    for (const [group, names] of Object.entries(GROUPS)) {
      const present = [];
      const absent = [];
      const target = group === "navigator" || group === "document" ? window[group === "navigator" ? "navigator" : "document"] : window;
      for (const name of names) {
        let exists;
        if (group === "css") continue; // handled below
        try {
          exists = name in target || typeof target[name] !== "undefined";
        } catch {
          exists = false;
        }
        (exists ? present : absent).push(name);
      }
      vectors[group] = { present, absent, presentCount: present.length };
    }

    const css = { supported: [], unsupported: [] };
    if (window.CSS && typeof CSS.supports === "function") {
      for (const feature of CSS_FEATURES) {
        let ok = false;
        try {
          ok = CSS.supports(feature);
        } catch {
          ok = false;
        }
        (ok ? css.supported : css.unsupported).push(feature);
      }
    }

    const totalPresent = Object.values(vectors).reduce(
      (acc, v) => acc + v.presentCount, 0
    );
    const cssPresent = css.supported.length;

    return {
      available: true,
      vectors,
      css,
      summary: {
        jsApisPresent: totalPresent,
        cssFeaturesPresent: cssPresent,
        vector: Object.values(vectors)
          .map((v) => v.present.join(","))
          .concat([css.supported.join(",")])
          .join("|"),
      },
      note:
        "Each API is a fraction of a bit, but the vector pins the browser "
        + "build more precisely than the User-Agent string, which most "
        + "browsers now freeze.",
    };
  },
};
