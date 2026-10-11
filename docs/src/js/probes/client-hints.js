/**
 * High-entropy Client Hints.
 *
 * The single most important signal in the modern fingerprint, and the reason
 * the UA string is being frozen.
 *
 * `navigator.userAgentData.brands` publishes the browser's own name and
 * version unprompted. On Chromium that includes "Brave" when Brave is in use —
 * the only place Brave identifies itself without a prompt. That is why the UA
 * parser above reports "Chromium-based" while this probe reports the truth.
 *
 * `getHighEntropyValues()` adds platform, architecture, bitness, and
 * platformVersion. platformVersion is what separates Windows 10 (10.0.x) from
 * Windows 11 (13.0.0+), which the UA string deliberately refuses to do.
 *
 * Returns null fields rather than guessing when a hint is withheld.
 */
export const probe = {
  id: "client-hints",
  label: "Client Hints (high-entropy)",
  family: "platform",
  bits: 6.5,
  async run() {
    const n = navigator;
    if (!n.userAgentData || typeof n.userAgentData.getHighEntropyValues !== "function") {
      return {
        available: true,
        brands: null,
        mobile: null,
        platform: null,
        architecture: null,
        bitness: null,
        model: null,
        platformVersion: null,
        uaFullVersion: null,
        wow64: null,
        note:
          "navigator.userAgentData unavailable (Firefox, Safari, older " +
          "Chromium). Only Sec-CH-UA low-entropy hints are sent to the server.",
      };
    }

    const data = n.userAgentData;
    const low = {
      brands: Array.isArray(data.brands) ? data.brands.slice() : null,
      mobile: typeof data.mobile === "boolean" ? data.mobile : null,
      platform: data.platform || null,
    };

    let high = {};
    try {
      high = await data.getHighEntropyValues([
        "architecture",
        "bitness",
        "model",
        "platformVersion",
        "uaFullVersion",
        "wow64",
      ]);
    } catch {
      high = { error: "withheld" };
    }

    // Resolved so the UI can show a real label rather than a version number.
    const windowsLabel =
      typeof high.platformVersion === "string"
        ? windowsLabelFromVersion(high.platformVersion)
        : null;

    return {
      available: true,
      ...low,
      architecture: high.architecture ?? null,
      bitness: high.bitness ?? null,
      model: high.model || null,
      platformVersion: high.platformVersion ?? null,
      platformVersionLabel: windowsLabel,
      uaFullVersion: high.uaFullVersion ?? null,
      wow64: typeof high.wow64 === "boolean" ? high.wow64 : null,
      note:
        "The only place Brave, Windows 11 and the true CPU architecture " +
        "identify themselves without a prompt. This is why browsers are " +
        "freezing the UA string: these hints carry more information.",
    };
  },
};

function windowsLabelFromVersion(version) {
  const major = parseInt(String(version).split(".")[0], 10);
  if (Number.isNaN(major)) return null;
  if (major === 0) return "Windows 7 / 8 / 8.1";
  if (major === 10) return "Windows 10";
  if (major >= 13) return "Windows 11";
  return `Windows (platformVersion ${version})`;
}
