/**
 * Browser detection.
 *
 * Category one. Everything a page can learn about a visitor's browser without
 * asking permission, from two sources:
 *
 *   1. The User-Agent string — a claim the browser makes about itself.
 *   2. Client Hints (`navigator.userAgentData`) — what the browser is willing
 *      to confirm when asked.
 *
 * Both are cross-checked here. Where they disagree, the disagreement is the
 * finding: a UA string claiming Chrome while Client Hints reports Brave is a
 * browser that does not want to be identified.
 *
 * Detection covers, in priority order:
 *
 *   - Privacy / hardened browsers (Tor, Brave) — the ones worth spotting
 *   - Legacy browsers (IE) — identifiable by engine tokens
 *   - In-app browsers and WebViews (Facebook, Instagram, Line, Electron)
 *   - Mobile browsers (Chrome iOS, Firefox iOS, Samsung Internet)
 *   - Desktop browsers (Chrome, Firefox, Safari, Edge, Opera, Vivaldi, Arc)
 *   - Headless / automated browsers (Selenium, Puppeteer, PhantomJS)
 *
 * Each result records *how* it was detected, because a detection method is part
 * of the signal — a browser detectable only by an artefact is behaving
 * differently from one that announces itself.
 */

/* ------------------------------------------------------------------ */
/* Browser definitions                                                 */
/* ------------------------------------------------------------------ */

/**
 * Ordered most-specific-first. The first pattern that matches wins, so
 * Firefox iOS must precede generic Firefox, and Edge must precede Chrome
 * (Edge's UA contains "Chrome" and "Safari").
 */
const BROWSER_RULES = [
  // --- Privacy / hardened -------------------------------------------
  {
    name: "Tor Browser",
    re: /TorBrowser\//i,
    engine: "Gecko",
    core: "Firefox",
    note: "Announces itself in the UA. Also detectable by a forced UTC timezone.",
  },
  {
    name: "Brave",
    re: null, // Brave is invisible in the UA; only Client Hints reveal it.
    engine: "Blink",
    core: "Chromium",
    hintOnly: "brand",
    note: "No UA token. Detectable only via Sec-CH-UA / userAgentData.brands.",
  },

  // --- Legacy ---------------------------------------------------------
  {
    name: "Internet Explorer 11",
    re: /Trident\/7\.0.*rv:([0-9.]+)/i,
    versionGroup: 1,
    engine: "Trident",
    core: "Trident",
  },
  {
    name: "Internet Explorer",
    re: /MSIE ([0-9.]+)/i,
    versionGroup: 1,
    engine: "Trident",
    core: "Trident",
  },
  {
    name: "Microsoft Edge (Legacy)",
    re: /Edge\/([0-9.]+)/i,
    versionGroup: 1,
    engine: "EdgeHTML",
    core: "EdgeHTML",
    note: "EdgeHTML-based Edge, discontinued in 2021. Distinguishable from Chromium Edge by the absence of 'Edg/'.",
  },

  // --- In-app browsers and WebViews -----------------------------------
  {
    name: "Facebook In-App Browser",
    re: /FBAN|FBAV/i,
    engine: null,
    core: "WebView",
    note: "Any app embedding Facebook's browser. The UA carries FBAN/FBAV.",
  },
  {
    name: "Instagram In-App Browser",
    re: /Instagram/i,
    engine: null,
    core: "WebView",
  },
  {
    name: "Line In-App Browser",
    re: /Line\//i,
    engine: "Blink",
    core: "Chromium",
  },
  {
    name: "WeChat In-App Browser",
    re: /MicroMessenger/i,
    engine: null,
    core: "WebView",
  },
  {
    name: "Alipay In-App Browser",
    re: /AlipayClient/i,
    engine: null,
    core: "WebView",
  },
  {
    name: "QQ Browser",
    re: /QQBrowser/i,
    engine: null,
    core: "Chromium",
  },
  {
    name: "Yandex Browser",
    re: /YaBrowser/i,
    engine: "Blink",
    core: "Chromium",
  },
  {
    name: "DuckDuckGo Browser",
    re: /DuckDuckGo/i,
    engine: "Blink",
    core: "Chromium",
  },
  {
    name: "Arc",
    re: /Arc\//i,
    engine: "Blink",
    core: "Chromium",
  },
  {
    name: "Vivaldi",
    re: /Vivaldi\/([0-9.]+)/i,
    versionGroup: 1,
    engine: "Blink",
    core: "Chromium",
  },
  {
    name: "Samsung Internet",
    re: /SamsungBrowser/i,
    engine: "Blink",
    core: "Chromium",
  },
  {
    name: "Opera Touch",
    re: /OPT\/([0-9.]+)/i,
    versionGroup: 1,
    engine: "Blink",
    core: "Chromium",
  },
  {
    name: "Opera Mini",
    re: /Opera Mini/i,
    engine: "Presto",
    core: "Presto",
    note: "Server-rendered proxy browser. The UA is the only signal.",
  },
  {
    name: "Silk",
    re: /Silk\/([0-9.]+)/i,
    versionGroup: 1,
    engine: "Blink",
    core: "Chromium",
    note: "Amazon devices. Distinguishable from Chrome by the Silk token.",
  },

  // --- Mobile ----------------------------------------------------------
  {
    name: "Chrome iOS",
    re: /CriOS\/([0-9.]+)/i,
    versionGroup: 1,
    engine: "WebKit",
    core: "Chromium (via WKWebView)",
    note: "Every iOS browser is WKWebView under Apple's rules, so the engine is WebKit regardless of brand.",
  },
  {
    name: "Firefox iOS",
    re: /FxiOS\/([0-9.]+)/i,
    versionGroup: 1,
    engine: "WebKit",
    core: "Firefox (via WKWebView)",
  },
  {
    name: "Safari Mobile",
    re: /Mobile\/[0-9A-Z]+ Safari/i,
    engine: "WebKit",
    core: "WebKit",
  },

  // --- Desktop ----------------------------------------------------------
  {
    name: "Microsoft Edge",
    re: /Edg(?:e|A|iOS)?\/([0-9.]+)/i,
    versionGroup: 1,
    engine: "Blink",
    core: "Chromium",
    note: "Chromium-based Edge uses 'Edg/' — the trailing 's' distinguishes it from legacy EdgeHTML.",
  },
  {
    name: "Opera",
    re: /OPR\/([0-9.]+)/i,
    versionGroup: 1,
    engine: "Blink",
    core: "Chromium",
  },
  {
    name: "Chrome",
    re: /Chrome\/([0-9.]+)/i,
    versionGroup: 1,
    engine: "Blink",
    core: "Chromium",
  },
  {
    name: "Firefox",
    re: /Firefox\/([0-9.]+)/i,
    versionGroup: 1,
    engine: "Gecko",
    core: "Gecko",
  },
  {
    name: "Safari",
    re: /Version\/([0-9.]+).*Safari/i,
    versionGroup: 1,
    engine: "WebKit",
    core: "WebKit",
  },
];

/* ------------------------------------------------------------------ */
/* Engine detection                                                    */
/* ------------------------------------------------------------------ */

/**
 * The rendering engine is the more stable identifier. A browser can rebrand
 * itself but cannot change its engine without becoming a different browser.
 */
function detectEngine(ua, browserName) {
  if (/Trident\/|MSIE /.test(ua)) return "Trident";
  if (/Edge\//.test(ua) && !/Edg\//.test(ua)) return "EdgeHTML";
  if (/Gecko\/\d+/.test(ua) && /Firefox\//.test(ua)) return "Gecko";
  if (/AppleWebKit/.test(ua)) {
    // WebKit covers both Blink (a WebKit fork) and genuine WebKit. Chromium
    // browsers report AppleWebKit too, so check for the Chrome token.
    if (/Chrome\/|CriOS\/|Edg\/|OPR\/|SamsungBrowser/.test(ua)) return "Blink (WebKit fork)";
    return "WebKit";
  }
  if (/Presto\//.test(ua)) return "Presto";
  return "Unknown";
}

/* ------------------------------------------------------------------ */
/* Platform from UA                                                    */
/* ------------------------------------------------------------------ */

function detectPlatform(ua) {
  const isMobile = /Mobi|Android|iPhone|iPod|IEMobile|Windows Phone/i.test(ua);
  const isTablet = /iPad|Tablet|Silk/i.test(ua) && !/Mobile/i.test(ua);

  let os = "Unknown";
  let osVersion = null;
  let deviceType = null;

  if (/Windows NT 10.0/.test(ua)) { os = "Windows"; osVersion = "10 / 11"; }
  else if (/Windows NT 6.3/.test(ua)) { os = "Windows"; osVersion = "8.1"; }
  else if (/Windows NT 6.2/.test(ua)) { os = "Windows"; osVersion = "8"; }
  else if (/Windows NT 6.1/.test(ua)) { os = "Windows"; osVersion = "7"; }
  else if (/Windows Phone 10/.test(ua)) { os = "Windows Phone"; osVersion = "10"; }
  else if (/Windows Phone 8/.test(ua)) { os = "Windows Phone"; osVersion = "8"; }
  else if (/Mac OS X ([0-9_]+)/.test(ua)) {
    os = "macOS";
    const v = (ua.match(/Mac OS X ([0-9_]+)/) || [])[1];
    if (v) osVersion = v.replace(/_/g, ".");
  }
  else if (/Android ([0-9.]+)/.test(ua)) {
    os = "Android";
    osVersion = (ua.match(/Android ([0-9.]+)/) || [])[1] || null;
  }
  else if (/CrOS/.test(ua)) { os = "Chrome OS"; }
  else if (/iPhone|iPad|iPod/.test(ua)) { os = "iOS"; }
  else if (/Linux/.test(ua)) { os = "Linux"; }
  else if (/FreeBSD/.test(ua)) { os = "FreeBSD"; }
  else if (/OpenBSD/.test(ua)) { os = "OpenBSD"; }

  if (isTablet) deviceType = "Tablet";
  else if (isMobile) deviceType = "Mobile";
  else deviceType = "Desktop / Laptop";

  return { os, osVersion, deviceType };
}

/* ------------------------------------------------------------------ */
/* Architecture                                                        */
/* ------------------------------------------------------------------ */

function detectArch(ua) {
  if (/Win64|x64|x86_64/.test(ua)) return "x86-64";
  if (/WOW64/.test(ua)) return "x86-64 (WoW64)";
  if (/i386|i686/.test(ua)) return "x86 (32-bit)";
  if (/arm64|aarch64/.test(ua)) return "ARM64";
  if (/armv[0-9]/.test(ua)) return "ARM";
  return "Unknown";
}

/* ------------------------------------------------------------------ */
/* Headless / automation                                               */
/* ------------------------------------------------------------------ */

/**
 * Automated browsers are detectable because automation leaves traces: missing
 * plugins, a `webdriver` flag, a headless UA token, or a plugins array that
 * is empty when it should not be.
 */
function detectAutomation(ua) {
  const flags = [];

  if (navigator.webdriver === true) flags.push("navigator.webdriver is true");
  if (/HeadlessChrome|Headless/i.test(ua)) flags.push("HeadlessChrome token in UA");
  if (/PhantomJS/.test(ua)) flags.push("PhantomJS token in UA");
  if (/Selenium|WebDriver/i.test(ua)) flags.push("Selenium/WebDriver token in UA");

  // Chrome always has the Chrome PDF Viewer plugin. An empty plugins array on
  // a Chrome UA means either automation or a hardened browser.
  if (/Chrome\//.test(ua) && navigator.plugins && navigator.plugins.length === 0) {
    flags.push("Chrome UA but zero plugins (automation or hardening)");
  }

  // Languages: an automated browser often reports none.
  if (!navigator.languages || navigator.languages.length === 0) {
    flags.push("navigator.languages is empty");
  }

  // Permissions API behaviour differs under automation.
  if (window.Permissions && navigator.permissions) {
    // Not a definitive signal on its own, so not flagged.
  }

  return {
    automated: flags.length > 0,
    flags,
  };
}

/* ------------------------------------------------------------------ */
/* WebView / Electron                                                 */
/* ------------------------------------------------------------------ */

function detectEnvironment(ua) {
  const env = [];

  // Electron sets a distinctive token.
  if (/Electron\//.test(ua)) env.push("Electron");
  if (/electron/i.test(navigator.userAgent)) env.push("Electron (navigator)");

  // Android WebView.
  if (/; wv\)|Version\/[0-9.]+ Chrome\/[0-9.]+ Mobile Safari/i.test(ua)) {
    env.push("Android WebView");
  }

  // iOS WKWebView.
  if (/iPhone|iPad|iPod/.test(ua) && !/Safari\//.test(ua) && /AppleWebKit/.test(ua)) {
    env.push("iOS WKWebView");
  }

  // Node.js / server-side rendering.
  if (typeof process !== "undefined" && process.versions && process.versions.node) {
    env.push("Node.js");
  }

  return env.length ? env : null;
}

/* ------------------------------------------------------------------ */
/* UA consistency checks                                               */
/* ------------------------------------------------------------------ */

/**
 * The interesting security question: does the UA string agree with itself?
 * A UA claiming Chrome while exposing Firefox-only APIs is either a
 * misconfigured browser, a spoofed UA, or an extension rewriting the string.
 */
function consistencyChecks(ua, browser, hints) {
  const issues = [];

  // Chrome token without the Chrome plugin.
  if (/Chrome\//.test(ua) && navigator.plugins && navigator.plugins.length === 0) {
    issues.push("UA claims Chrome but reports no plugins");
  }

  // Safari claims but no AppleWebKit token.
  if (/Safari\//.test(ua) && !/AppleWebKit/.test(ua)) {
    issues.push("UA contains Safari but no AppleWebKit token");
  }

  // Firefox claims but no Gecko token.
  if (/Firefox\//.test(ua) && !/Gecko\//.test(ua)) {
    issues.push("UA claims Firefox but no Gecko token");
  }

  // Cross-check against Client Hints when available.
  if (hints && Array.isArray(hints.brands)) {
    const hintBrands = hints.brands.map((b) => b.brand.toLowerCase());
    const uaLower = ua.toLowerCase();

    if (browser.name === "Chrome" && hintBrands.some((b) => b.includes("brave"))) {
      issues.push("UA claims Chrome but Client Hints report Brave — UA may be spoofed or rewritten");
    }
    if (browser.name === "Chrome" && !hintBrands.some((b) => b.includes("chromium"))) {
      issues.push("UA claims Chrome but Client Hints do not confirm Chromium");
    }
    if (browser.name === "Firefox" && hintBrands.some((b) => b.includes("chromium"))) {
      issues.push("UA claims Firefox but Client Hints report Chromium");
    }
  }

  // OS cross-check: a Windows UA on a non-Windows platform.
  if (/Windows/.test(ua) && navigator.platform && !/win/i.test(navigator.platform)) {
    issues.push(`UA claims Windows but navigator.platform is "${navigator.platform}"`);
  }

  return issues.length ? issues : null;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function detectBrowser(ua, hints) {
  let detected = null;
  let matchedRule = null;

  for (const rule of BROWSER_RULES) {
    if (!rule.re) continue;
    const m = ua.match(rule.re);
    if (m) {
      detected = rule.name;
      matchedRule = rule;
      break;
    }
  }

  // Version: from the matched rule's capture group, else from a generic
  // browser-specific token.
  let version = null;
  if (matchedRule && matchedRule.versionGroup && ua.match(matchedRule.re)) {
    version = ua.match(matchedRule.re)[matchedRule.versionGroup] || null;
  }

  // Brave has no UA token — it is only visible via Client Hints.
  let braveViaHints = false;
  if (hints && Array.isArray(hints.brands)) {
    braveViaHints = hints.brands.some((b) => /brave/i.test(b.brand));
  }
  if (!detected && braveViaHints) {
    detected = "Brave";
    matchedRule = BROWSER_RULES.find((r) => r.name === "Brave");
  }

  const platform = detectPlatform(ua);
  const arch = detectArch(ua);
  const automation = detectAutomation(ua);
  const environment = detectEnvironment(ua);
  const issues = consistencyChecks(ua, { name: detected }, hints);

  // Detection method, for the report.
  const method = [];
  if (matchedRule && matchedRule.re) method.push(`UA token (${matchedRule.re.source.slice(0, 24)}…)`);
  if (braveViaHints) method.push("Client Hints brands");
  if (matchedRule && matchedRule.note) method.push(matchedRule.note);

  const engine = matchedRule?.engine || detectEngine(ua, detected);
  const core = matchedRule?.core || (detected ? "Unknown" : null);

  return {
    browser: detected || "Unknown",
    version,
    engine,
    core,
    ...platform,
    arch,
    automation,
    environment,
    consistencyIssues: issues,
    detectionMethod: method,
    confidence:
      detected && matchedRule && matchedRule.re
        ? "high (UA token)"
        : detected && braveViaHints
          ? "high (Client Hints)"
          : detected
            ? "medium (inference)"
            : "none",
  };
}

export const probe = {
  id: "browser-detection",
  label: "Browser detection",
  family: "platform",
  bits: 6.0,
  async run() {
    const ua = navigator.userAgent;
    const hints = (() => {
      const d = navigator.userAgentData;
      if (!d || !Array.isArray(d.brands)) return { brands: null };
      return { brands: d.brands.map((b) => ({ ...b })) };
    })();

    const result = detectBrowser(ua, hints);

    return {
      available: true,
      userAgent: ua,
      ...result,
      clientHintsBrands: hints.brands,
      note:
        "Browser identity comes from the UA string and is cross-checked " +
        "against Client Hints. Where they disagree — a UA claiming Chrome " +
        "while hints report Brave — the disagreement is the finding: " +
        "something is rewriting the string.",
    };
  },
};

export { detectBrowser };
