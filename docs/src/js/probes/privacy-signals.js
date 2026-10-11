/**
 * Privacy signals and fingerprinting resistance.
 *
 * Several independent signals, reported separately because they mean different
 * things:
 *
 *   - doNotTrack / GPC: what the user has *asked* for. Honoured by almost no
 *     one, but its presence is a preference signal.
 *   - Private browsing: detectable in several engines by probing storage
 *     behaviour — Safari's private mode refuses localStorage writes outright.
 *   - Fingerprinting resistance: whether the browser is actively normalising
 *     the signals this page relies on. Detected by looking for the specific
 *     artefacts each mitigation produces, never assumed.
 */

function detectPrivateBrowsing() {
  // Safari private mode throws on setItem. Chrome's Incognito allows it but
  // clears on close, which is not observable from inside a single page.
  try {
    const k = "__privacy_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return { isPrivate: false, method: "localStorage writable" };
  } catch {
    return { isPrivate: true, method: "localStorage write refused (Safari private mode)" };
  }
}

function detectFingerprintResistance() {
  const signals = [];

  // Brave: named in Client Hints brands.
  const brands = navigator.userAgentData?.brands || [];
  if (brands.some((b) => /brave/i.test(b.brand))) {
    signals.push("Brave (via Client Hints)");
  }

  // Tor Browser: forces the window to the screen size and zeroes the timezone.
  if (window.screen && window.outerWidth && window.outerWidth === window.screen.width) {
    signals.push("window matches screen exactly (Tor Browser behaviour)");
  }

  // Firefox resistFingerprinting: caps hardwareConcurrency and reports a
  // generic WebGL renderer.
  const renderer = (() => {
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl");
      if (!gl) return null;
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null;
    } catch {
      return null;
    }
  })();

  if (renderer && /swiftshader|llvmpipe|angle \(google/i.test(renderer)) {
    signals.push(`generic software renderer reported ("${renderer}")`);
  }

  if (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 2) {
    signals.push(`hardwareConcurrency capped at ${navigator.hardwareConcurrency}`);
  }

  // A blocked canvas is the strongest single indicator of an anti-fingerprinting
  // layer, and it is directly observable.
  let canvasBlocked = false;
  try {
    const c = document.createElement("canvas");
    c.width = 5;
    c.height = 5;
    canvasBlocked = !c.toDataURL();
  } catch {
    canvasBlocked = true;
  }
  if (canvasBlocked) signals.push("canvas toDataURL blocked or returned empty");

  return {
    resistant: signals.length > 0,
    signals,
    rendererReported: renderer,
  };
}

export const probe = {
  id: "privacy-signals",
  label: "Privacy signals & fingerprinting resistance",
  family: "privacy",
  bits: 3.5,
  async run() {
    const dnt = navigator.doNotTrack;
    const gpc = "globalPrivacyControl" in navigator ? navigator.globalPrivacyControl : null;

    return {
      available: true,
      doNotTrack: dnt === "1" ? "Enabled" : dnt === "0" ? "Disabled" : dnt === null ? "Not set (absent)" : `Other (${dnt})`,
      globalPrivacyControl: gpc === true ? "Enabled" : gpc === false ? "Not set" : "Unsupported",
      privateBrowsing: detectPrivateBrowsing(),
      fingerprintResistance: detectFingerprintResistance(),
      note:
        "Do Not Track and Global Privacy Control are requests, not guarantees. " +
        "Fingerprinting resistance is detected from artefacts, never assumed — " +
        "a browser that normalises its canvas is reporting a constant, and a " +
        "constant is observable.",
    };
  },
};
