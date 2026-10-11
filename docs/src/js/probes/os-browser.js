/**
 * User-Agent parsing.
 *
 * The UA string is the least trustworthy signal — every browser lies about
 * something, and Chrome froze its version to reduce entropy. But it is still
 * the only place OS and browser identity are advertised unprompted.
 *
 * Parsed here rather than handed over raw, because the interesting question is
 * not "what does it say" but "what does it claim versus what everything else
 * reveals". Those two disagreeing is itself a finding.
 */

/** Windows 11 ships platformVersion 13.0.0 and up; 10.0.x is Windows 10. */
function windowsVersionFromPlatform(platformVersion) {
  if (!platformVersion) return null;
  const parts = String(platformVersion).split(".").map((n) => parseInt(n, 10));
  const major = parts[0] || 0;
  if (major === 0) return "Windows 7 / 8 / 8.1";
  if (major === 10) return "Windows 10";
  if (major >= 13) return "Windows 11";
  return "Windows (unknown version)";
}

const MAC_VERSIONS = {
  "10_9": "OS X Mavericks (10.9)",
  "10_10": "OS X Yosemite (10.10)",
  "10_11": "OS X El Capitan (10.11)",
  "10_12": "macOS Sierra (10.12)",
  "10_13": "macOS High Sierra (10.13)",
  "10_14": "macOS Mojave (10.14)",
  "10_15": "macOS Catalina (10.15)",
  "11": "macOS Big Sur (11)",
  "12": "macOS Monterey (12)",
  "13": "macOS Ventura (13)",
  "14": "macOS Sonoma (14)",
  "15": "macOS Sequoia (15)",
  "16": "macOS Tahoe (16)",
};

function parseMacOS(ua) {
  const m = ua.match(/Mac OS X ([0-9_]+)/) || ua.match(/Macintosh; .* OS X ([0-9_]+)/);
  if (!m) return null;
  return MAC_VERSIONS[m[1]] || `macOS ${m[1].replace(/_/g, ".")}`;
}

function parseAndroid(ua) {
  const m = ua.match(/Android ([0-9.]+)/);
  if (!m) return null;
  const ver = m[1];
  return { version: ver, label: `Android ${ver}` };
}

export function parseUserAgent(ua) {
  if (!ua) return { os: null, osVersion: null, browser: null, deviceType: null, bitness: null };

  let os = null;
  let osVersion = null;
  let deviceType = null;
  let bitness = null;
  let browser = null;

  // Device type
  if (/Mobi|Android|iPhone|iPad|iPod/.test(ua)) {
    deviceType = /iPad|Tablet/.test(ua) ? "Tablet" : "Mobile";
  } else if (/Windows Phone|IEMobile/.test(ua)) {
    deviceType = "Mobile";
  } else {
    deviceType = "Desktop / Laptop";
  }

  // OS
  if (/Windows NT 10.0/.test(ua)) {
    os = "Windows";
    osVersion = "Windows 10/11 (distinguished by Client Hints)";
  } else if (/Windows NT 6.3/.test(ua)) {
    os = "Windows";
    osVersion = "Windows 8.1";
  } else if (/Windows NT 6.2/.test(ua)) {
    os = "Windows";
    osVersion = "Windows 8";
  } else if (/Windows NT 6.1/.test(ua)) {
    os = "Windows";
    osVersion = "Windows 7";
  } else if (/Windows Phone/.test(ua)) {
    os = "Windows Phone";
  } else if (/Mac OS X|Macintosh/.test(ua)) {
    os = "macOS";
    osVersion = parseMacOS(ua);
  } else if (/Android/.test(ua)) {
    os = "Android";
    osVersion = parseAndroid(ua);
  } else if (/CrOS/.test(ua)) {
    os = "Chrome OS";
  } else if (/Linux/.test(ua)) {
    os = "Linux";
  } else if (/(iPhone|iPad|iPod).*OS/.test(ua)) {
    os = "iOS";
    const m = ua.match(/OS ([0-9_]+)/);
    if (m) osVersion = `iOS ${m[1].replace(/_/g, ".")}`;
  }

  // Bitness
  if (/Win64|x64|x86_64/.test(ua)) bitness = "64-bit";
  else if (/WOW64/.test(ua)) bitness = "64-bit (WoW64)";
  else if (/i386|i686/.test(ua)) bitness = "32-bit";
  else if (/arm64|aarch64/.test(ua)) bitness = "ARM64";
  else if (/arm/.test(ua)) bitness = "ARM";

  // Browser — order matters: check the specific engines before the generic.
  if (/Brave\//.test(ua)) {
    // Brave does not put itself in the UA; this branch only fires if a site
    // is served the Sec-CH-UA header instead. See client-hints.js.
    browser = "Brave";
  } else if (/Edg\//.test(ua)) {
    browser = "Microsoft Edge";
  } else if (/OPR\//.test(ua) || /Opera\//.test(ua)) {
    browser = "Opera";
  } else if (/Firefox\//.test(ua)) {
    browser = /Seamonkey/.test(ua) ? "SeaMonkey" : "Firefox";
  } else if (/Chrome\/|CriOS\//.test(ua)) {
    browser = "Chromium-based (Chrome, Brave, Edge, Opera, Vivaldi, …)";
  } else if (/Safari\//.test(ua)) {
    browser = "Safari";
  } else if (/MSIE|Trident/.test(ua)) {
    browser = "Internet Explorer";
  }

  // The single most important caveat, reported rather than implied.
  const lie = [];
  if (/Chrome\/(\d+)/.test(ua) && /Edg\//.test(ua)) {
    lie.push("claims Chrome while being Edge");
  }
  if (/Safari/.test(ua) && /Chrome/.test(ua)) {
    lie.push("contains Safari and Chrome tokens (both — only one is real)");
  }
  if (browser && /Chromium-based/.test(browser) && /Brave/.test(ua)) {
    lie.push("Brave is not named in the UA; it is only visible via Client Hints");
  }

  return {
    os,
    osVersion,
    browser,
    deviceType,
    bitness,
    engine: /Gecko\/|Firefox/.test(ua)
      ? "Gecko"
      : /AppleWebKit/.test(ua)
        ? "WebKit/Blink"
        : /Trident/.test(ua)
          ? "Trident"
          : /Blink/.test(ua)
            ? "Blink"
            : "unknown",
    caveats: lie.length ? lie : null,
    note:
      "The UA is a claim, not a measurement. Every token here is something the " +
      "browser chose to publish. Where it disagrees with the rest of the page " +
      "(canvas, WebGL, fonts), the disagreement is the signal.",
  };
}

export const probe = {
  id: "os-browser",
  label: "OS & browser from User-Agent",
  family: "platform",
  bits: 4.0,
  async run() {
    return {
      available: true,
      ...parseUserAgent(navigator.userAgent),
    };
  },
};

export { windowsVersionFromPlatform };
