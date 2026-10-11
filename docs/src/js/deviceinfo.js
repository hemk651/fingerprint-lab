/**
 * Device Info report.
 *
 * Renders the full "what did this page learn about you" report, organised by
 * the same categories a device-info site uses, with every value tagged by how
 * it was obtained:
 *
 *   [client]      Detected in the browser, no permission, no network.
 *   [blocked]     The browser withholds or normalises this signal.
 *   [server]      Cannot be known without contacting a server.
 *   [permission]  Requires the user to grant access first.
 *
 * The [server] tag is the honest half of this report. A page that shows you an
 * IP address, a geolocation or an ISP is telling you what its *server* learned,
 * not what your browser volunteered. Both halves are worth seeing side by side,
 * because the difference between them is the actual privacy boundary.
 */

import { FAMILIES } from "./entropy.js";

const el = (tag, className, content) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content instanceof Node) {
    node.append(content);
  } else if (content !== undefined && content !== null) {
    node.textContent = String(content);
  }
  return node;
};

const TAG_LABELS = {
  client: ["client", "client-side"],
  blocked: ["blocked", "withheld"],
  server: ["server", "requires server"],
  permission: ["permission", "permission required"],
};

function row(label, value, tag = "client", note = null) {
  const tr = el("tr", `tag-${tag}`);
  tr.append(
    el("td", "di-label", label),
    el("td", "di-value", value === null || value === undefined ? "—" : value),
    el("td", "di-tag", TAG_LABELS[tag]?.[1] || tag)
  );
  return tr;
}

function section(title, blurb) {
  const sec = el("section", "di-section");
  sec.append(el("h3", "di-section-title", title));
  if (blurb) sec.append(el("p", "di-section-blurb", blurb));
  const table = el("table", "di-table");
  table.append(el("tbody", null, null));
  sec.append(table);
  return sec;
}

function addRows(sec, rows) {
  const tbody = sec.querySelector("tbody");
  for (const r of rows) tbody.append(r);
}

/** Slugify a section title into a stable anchor id. */
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Build the whole report.
 *
 * `results` is the array of probe results in registry order. Values are read
 * defensively: anything missing becomes a [blocked] or [server] row rather
 * than a gap, so the report always shows the full shape of what was asked.
 *
 * `nav` is the category navigation. It is built as sections are appended,
 * because the section list is the source of truth — a hand-maintained nav
 * would silently drift the next time a section is renamed.
 */
export function renderDeviceInfo(container, results, nav) {
  container.replaceChildren();
  if (nav) nav.replaceChildren();

  // Append a section to the DOM and register it in the category nav.
  const sections = [];
  const emit = (sec) => {
    const title = sec.querySelector(".di-section-title")?.textContent || "Section";
    const id = slugify(title);
    sec.id = `di-${id}`;
    sec.dataset.section = title;
    container.append(sec);
    sections.push({ id: sec.id, title });
  };

  const finish = () => {
    if (!nav) return;
    for (const s of sections) {
      const link = el("a", "di-nav-link", s.title);
      link.href = `#${s.id}`;
      nav.append(link);
    }
    // The probe cards are a separate top-level section rendered after this
    // report. Without an explicit link they sit at the very bottom of a long
    // page with no way to reach them.
    const cards = el("a", "di-nav-link di-nav-link-external", "↓ Entropy signal cards");
    cards.href = "#signals";
    nav.append(cards);
  };

  const byId = new Map(results.map((r) => [r.id, r]));
  const val = (id, key) => {
    const r = byId.get(id);
    if (!r || !r.available || !r.values) return null;
    return r.values[key];
  };
  const present = (id) => {
    const r = byId.get(id);
    return Boolean(r && r.available);
  };

  const browser = results.find((r) => r.id === "browser-detection")?.values || {};
  const hints = results.find((r) => r.id === "client-hints")?.values || {};
  const media = results.find((r) => r.id === "media-devices")?.values || {};
  const caps = results.find((r) => r.id === "device-capabilities")?.values || {};
  const motion = results.find((r) => r.id === "device-motion")?.values || {};
  const plugins = results.find((r) => r.id === "plugins-mime")?.values || {};
  const privacy = results.find((r) => r.id === "privacy-signals")?.values || {};
  const adblock = results.find((r) => r.id === "adblock-detect")?.values || {};
  const perf = results.find((r) => r.id === "performance-detail")?.values || {};
  const interaction = results.find((r) => r.id === "page-interaction")?.values || {};
  const display = results.find((r) => r.id === "display")?.values || {};
  const hardware = results.find((r) => r.id === "hardware")?.values || {};
  const storage = results.find((r) => r.id === "storage")?.values || {};
  const network = results.find((r) => r.id === "network")?.values || {};
  const canvas = results.find((r) => r.id === "canvas")?.values || {};
  const audio = results.find((r) => r.id === "audio")?.values || {};
  const webrtc = results.find((r) => r.id === "webrtc")?.values || {};
  const locale = results.find((r) => r.id === "locale")?.values || {};
  const features = results.find((r) => r.id === "features")?.values || {};

  // ---- Browser Detection (category one) --------------------------------
  {
    const sec = section("Browser Detection",
      "Which browser is in use, which engine renders the page, and which core it is built on. Detected from the User-Agent string and cross-checked against Client Hints.");

    const brands = Array.isArray(browser.clientHintsBrands)
      ? browser.clientHintsBrands.map((b) => `${b.brand} ${b.version}`).join(", ")
      : null;

    const rows = [
      row("Detected Browser", browser.browser || "Unknown", "client"),
      row("Browser Version", browser.version || "Unknown", "client"),
      row("Base Engine", browser.engine || "Unknown", "client"),
      row("Browser Core", browser.core || "Unknown", "client"),
      row("Confidence", browser.confidence || "Unknown", "client"),
      row("Detection Method", browser.detectionMethod?.length ? browser.detectionMethod.join("; ") : "Unknown", "client"),
      row("User-Agent String", browser.userAgent || navigator.userAgent, "client"),
      row("Client Hints Brands", brands || "Not available", brands ? "client" : "blocked"),
      row("Platform (from UA)", browser.deviceType || "Unknown", "client"),
      row("Operating System", browser.os || "Unknown", "client"),
      row("OS Version", browser.osVersion || "Unknown", "client"),
      row("Architecture (from UA)", browser.arch || "Unknown", "client"),
      row("Platform Version", hints.platformVersion || "Unknown", "client"),
    ];

    if (browser.automation?.automated) {
      rows.push(row("Automation Detected", `Yes — ${browser.automation.flags.join("; ")}`, "client"));
    } else {
      rows.push(row("Automation Detected", "No", "client"));
    }

    if (browser.environment?.length) {
      rows.push(row("Environment", browser.environment.join(", "), "client"));
    }

    if (browser.consistencyIssues?.length) {
      rows.push(row("UA Consistency Issues", browser.consistencyIssues.join("; "), "blocked",
        "The UA string disagrees with itself or with Client Hints. Something is rewriting it."));
    } else {
      rows.push(row("UA Consistency Issues", "None — UA is self-consistent", "client"));
    }

    addRows(sec, rows);
    emit(sec);
  }

  // ---- User Agent Analysis ----------------------------------------------
  {
    const sec = section("User Agent Analysis",
      "The User-Agent string is a list of product tokens. Most are historical padding — Mozilla/5.0 appears in every modern browser, AppleWebKit appears in Chromium, and Safari appears in browsers that are not Safari.");

    const tokens = browser.uaTokens || {};
    const products = Array.isArray(tokens.products) ? tokens.products : [];

    const uaRows = [
      row("Full User-Agent String", browser.userAgent || navigator.userAgent, "client"),
      row("Product Comments", tokens.comments?.length ? tokens.comments.join(" | ") : "None", "client"),
      row("Tail (post-comment products)", tokens.tail || "None", "client"),
    ];

    for (const p of products) {
      const label = p.greased ? `${p.name} (grease token)` : p.name;
      uaRows.push(row(label, p.version || "—", "client",
        p.greased ? "Deliberately vague token inserted by Chromium to stop sites hardcoding a brand list." : null));
    }

    uaRows.push(row("Grease Token Count", tokens.greasedCount ?? 0, "client"));
    uaRows.push(row("Engine Tokens Present", tokens.engineTokens?.length ? tokens.engineTokens.join(", ") : "None", "client"));

    addRows(sec, uaRows);
    emit(sec);
  }

  // ---- Browser Identity Strings ------------------------------------------
  {
    const sec = section("Browser Identity Strings",
      "Raw identity strings the browser publishes on navigator. Legacy fields, still shipped and still identifying.");

    const identity = results.find((r) => r.id === "identity")?.values || {};

    addRows(sec, [
      row("navigator.appVersion", identity.appVersion || "absent", "client",
        "A duplicate of userAgent. One of the oldest fingerprinting surfaces."),
      row("navigator.product", identity.product || "absent", "client"),
      row("navigator.productSub", identity.productSub || "absent", "client",
        "A 2004-era field with a near-fixed value on some browsers."),
      row("navigator.vendor", identity.vendor || "absent", "client"),
      row("navigator.oscpu", identity.oscpu || "absent", "client",
        "Firefox-only. Reports the underlying OS build."),
      row("navigator.standalone", identity.standalone === null ? "absent" : String(identity.standalone), "client"),
      row("navigator.pdfViewerEnabled", identity.pdfViewerEnabled ? "Yes" : "No", "client"),
      row("navigator.webdriver", identity.webdriver ? "true — automated browser" : "false", "client"),
      row("navigator.platform", typeof navigator.platform === "string" ? navigator.platform : "absent", "client"),
      row("User-Agent Hash (SHA-256)", identity.userAgentHash || "unavailable", "client",
        "A stable identifier for the exact UA string. Computed in this tab."),
    ]);
    emit(sec);
  }

  // ---- Client Hints (full) -----------------------------------------------
  {
    const sec = section("Client Hints",
      "The modern replacement for the UA string. These values are sent only when the browser chooses to send them, and they carry more identifying detail than the UA — which is why the UA is being frozen.");

    const fullVersionList = Array.isArray(hints.fullVersionList)
      ? hints.fullVersionList.map((b) => `${b.brand} ${b.version}`).join(", ")
      : "Not available";

    addRows(sec, [
      row("userAgentData Supported", hints.brands ? "Yes" : "No", hints.brands ? "client" : "blocked",
        hints.brands ? null : "Firefox and Safari do not implement Client Hints."),
      row("Full Version List", fullVersionList, hints.fullVersionList ? "client" : "blocked"),
      row("Platform Version (resolved)", hints.platformVersionLabel || "Unknown", hints.platformVersionLabel ? "client" : "blocked"),
      row("Architecture", hints.architecture || "Unknown", "client",
        "The true CPU architecture — the closest a page gets to a hardware model number."),
      row("Model", hints.model || "(empty)", "client",
        "Empty on desktop. Populated on Android and ChromeOS, where it narrows to a specific device."),
      row("WoW64", hints.wow64 === true ? "Yes" : hints.wow64 === false ? "No" : "Unknown", "client",
        "WoW64 means a 32-bit browser running on 64-bit Windows."),
    ]);
    emit(sec);
  }

  // ---- Browser Capabilities ----------------------------------------------
  {
    const sec = section("Browser Capabilities",
      "Which APIs this build exposes. Each one is a fraction of a bit, but the vector as a whole pins the browser version more precisely than the UA string does.");

    const vectors = features.vectors || {};
    const capRows = [];

    if (vectors.navigator) {
      const total = vectors.navigator.present.length + vectors.navigator.absent.length;
      capRows.push(row("navigator APIs Present", `${vectors.navigator.presentCount} of ${total}`, "client"));
      capRows.push(row("navigator APIs Missing", vectors.navigator.absent.join(", ") || "None", "client"));
    }
    if (vectors.window) {
      capRows.push(row("window APIs Present", `${vectors.window.presentCount}`, "client"));
    }

    const cssSupported = features.css?.supported || [];
    capRows.push(row("CSS Features Supported", `${cssSupported.length}`, "client"));
    for (const feat of cssSupported.slice(0, 12)) {
      capRows.push(row(feat, "Supported", "client"));
    }
    capRows.push(row("Summary", features.summary
      ? `${features.summary.jsApisPresent} JS APIs, ${features.summary.cssFeaturesPresent} CSS features`
      : "Unknown", "client"));

    addRows(sec, capRows);
    emit(sec);
  }

  // ---- Device & OS -----------------------------------------------------
  {
    const sec = section("Device Type & Operating System",
      "What the machine claims to be, versus what the browser's own high-entropy hints reveal.");

    const osName = browser.os || "Unknown";
    const osDetail = browser.osVersion;
    const winLabel = hints.platformVersionLabel;

    // Compose the OS display: prefer the Client Hints label for Windows,
    // fall back to the UA-derived name, then the detail string.
    let osDisplay = osName;
    if (osName === "Windows" && winLabel) {
      osDisplay = `${winLabel} (64-bit)`;
    } else if (osDetail) {
      osDisplay = `${osName} — ${osDetail}`;
    }

    addRows(sec, [
      row("Device Type / Model", browser.deviceType || "Unknown"),
      row("Operating System", osDisplay, "client",
        osName === "Windows" && !winLabel ? "UA says Windows 10/11; only Client Hints distinguish them." : null),
      row("True OS Core", winLabel || "Unknown", winLabel ? "client" : "blocked",
        winLabel ? null : "platformVersion withheld — Firefox and Safari do not implement Client Hints."),
      row("CPU Architecture", hints.architecture || browser.arch || "Unknown", "client"),
      row("Bitness", hints.bitness || browser.arch || "Unknown", "client"),
      row("Model", hints.model || "(empty)", "client"),
    ]);
    emit(sec);
  }

  // ---- Browser ---------------------------------------------------------
  {
    const sec = section("Browser",
      "The browser's own identity. Client Hints are the only place Brave identifies itself.");

    const brands = Array.isArray(hints.brands) ? hints.brands : null;
    const brandStr = brands ? brands.map((b) => `${b.brand} ${b.version}`).join(", ") : null;

    addRows(sec, [
      row("Browser", brandStr || browser.browser || "Unknown", "client"),
      row("True Browser Core", brandStr || browser.core || "Unknown", brandStr ? "client" : "blocked",
        brandStr ? null : "Sec-CH-UA withheld; falling back to the User-Agent string."),
      row("Engine", browser.engine || "Unknown", "client"),
      row("Mobile", hints.mobile === true ? "Yes" : hints.mobile === false ? "No" : "Unknown", "client"),
      row("Platform", hints.platform || "Unknown", "client"),
      row("Platform Version", hints.platformVersion || "Unknown", "client"),
      row("Full Version", hints.uaFullVersion || "Unknown", "client"),
      row("WoW64", hints.wow64 === true ? "Yes" : hints.wow64 === false ? "No" : "Unknown", "client"),
      row("Web Driver (automation)", val("hardware", "webdriver") ? "Yes — automated browser" : "No", "client"),
      row("PDF Viewer Enabled", val("hardware", "pdfViewerEnabled") ? "Yes" : "No", "client"),
    ]);
    emit(sec);
  }

  // ---- Network ---------------------------------------------------------
  {
    const sec = section("Network & Connection",
      "Split into what the browser knows and what only a server can know. The second group is the majority of a device-info report.");

    addRows(sec, [
      row("IP Address (WAN)", "IPv6 and IPv4 addresses", "server",
        "A page cannot see its own address. This requires a server to observe the connection."),
      row("IP Address (LAN)", webrtc.exposure === "mdns-only" ? "Hidden (mDNS)" : webrtc.exposure === "local-address-visible" ? "Visible" : "Unknown",
        webrtc.exposure === "local-address-visible" ? "client" : "blocked",
        "WebRTC now replaces local addresses with mDNS hostnames in Chrome and Safari."),
      row("Hostname", "Unknown", "server", "Not exposed to JavaScript at all."),
      row("Location (Country / Region / City)", "Requires server-side IP geolocation", "server"),
      row("ISP", "Requires server-side IP geolocation", "server"),
      row("Nameservers", "Unknown", "server", "DNS configuration is not exposed to a page."),
      row("Tor IP Address", "No", "server", "Tor exit nodes are only visible server-side."),
      row("VPN IP Address", "Not detected", "server"),
      row("Proxy IP Address", "None detected", "server"),
      row("Connection Status (LAN)", network.online === true ? "Connected" : "Disconnected", "client"),
      row("Internet Access", network.online === true ? "Yes" : "No", "client"),
      row("Connection Type (LAN)", network.type || "Unknown", "client"),
      row("Effective Connection Type", network.effectiveType || "Unknown", "client"),
      row("Downlink (Mbps)", network.downlinkMbps ?? "Unknown", "client"),
      row("Round-Trip Time (ms)", network.rttMs ?? "Unknown", "client"),
      row("Save Data", network.saveData ? "Yes" : "No", "client"),
      row("Languages", Array.isArray(locale.languages) ? locale.languages.join(", ") : "Unknown", "client"),
    ]);
    emit(sec);
  }

  // ---- Date, time & locale ---------------------------------------------
  {
    const sec = section("Date, Time & Locale",
      "The system clock and its settings. Time zone is one of the strongest low-effort signals.");

    const now = new Date();
    addRows(sec, [
      row("System Date & Time", now.toLocaleString("en-US", { dateStyle: "full", timeStyle: "medium" }), "client"),
      row("System Time Zone", locale.timeZone || "Unknown", "client"),
      row("UTC Offset (minutes)", locale.timeZoneOffsetMinutes ?? "Unknown", "client"),
      row("Intl Locale", locale.intlLocale || "Unknown", "client"),
      row("Calendar", locale.calendar || "Unknown", "client"),
      row("Numbering System", locale.numberingSystem || "Unknown", "client"),
    ]);
    emit(sec);
  }

  // ---- Fingerprinting resistance ---------------------------------------
  {
    const sec = section("Fingerprinting Resistance",
      "Whether this browser is actively normalising the signals this page relies on. Detected from artefacts, never assumed.");

    const resistance = privacy.fingerprintResistance || {};
    const signals = Array.isArray(resistance.signals) ? resistance.signals : [];

    addRows(sec, [
      row("Fingerprinting Resistance", resistance.resistant ? "Detected" : "Not detected", "client"),
      row("Resistance Signals", signals.length ? signals.join("; ") : "None observed", "client"),
      row("Canvas", canvas.available === false ? "Blocked" : "Supported", canvas.available === false ? "blocked" : "client"),
      row("Canvas Fingerprinting", canvas.available === false ? "Spoofed / blocked" : "Allowed", canvas.available === false ? "blocked" : "client"),
      row("AudioContext", audio.available === false ? "Blocked" : "Supported", audio.available === false ? "blocked" : "client"),
      row("AudioContext Fingerprinting", audio.available === false ? "Blocked" : "Allowed", audio.available === false ? "blocked" : "client"),
      row("User Agent", navigator.userAgent, "client"),
      row("Do Not Track", privacy.doNotTrack || "Not set", "client"),
      row("Global Privacy Control", privacy.globalPrivacyControl || "Unsupported", "client"),
      row("Private Browsing Mode", privacy.privateBrowsing?.isPrivate ? "Yes" : "No", "client",
        privacy.privateBrowsing?.method || null),
      row("Ad Blocker", adblock.adBlockerDetected ? "Detected" : "Not detected", "client"),
      row("Ghostery Extension", adblock.ghosteryDetected ? "Detected" : "Not detected", "client"),
    ]);
    emit(sec);
  }

  // ---- Media devices ---------------------------------------------------
  {
    const sec = section("Media Devices",
      "Counts are available without permission. Labels are redacted until access is granted.");

    addRows(sec, [
      row("Speakers", media.speakers ?? "Unknown", "client"),
      row("Speaker Labels", media.labelsRevealed ? `${media.labelsRevealed} revealed` : "Redacted", media.labelsRevealed ? "client" : "blocked"),
      row("Microphones", media.microphones ?? "Unknown", "client"),
      row("Microphone Labels", media.labelsRevealed ? `${media.labelsRevealed} revealed` : "Redacted", media.labelsRevealed ? "client" : "blocked"),
      row("Cameras", media.cameras ?? "Unknown", "client"),
      row("Camera Labels", media.labelsRevealed ? `${media.labelsRevealed} revealed` : "Redacted", media.labelsRevealed ? "client" : "blocked"),
      row("Audio / Microphone Permission", "Not granted", "permission",
        "Permission required to detect correct number of devices and their labels."),
    ]);
    emit(sec);
  }

  // ---- Hardware --------------------------------------------------------
  {
    const sec = section("Hardware",
      "CPU, GPU, memory and battery. The GPU string is one of the highest-value signals in the entire report.");

    const webgl = results.find((r) => r.id === "webgl")?.values || {};

    addRows(sec, [
      row("Graphics Card / GPU", webgl.unmaskedRenderer || webgl.renderer || "Unknown", "client"),
      row("GPU Vendor", webgl.unmaskedVendor || webgl.vendor || "Unknown", "client"),
      row("WebGL Version", webgl.version || "Unknown", "client"),
      row("CPU Cores", hardware.hardwareConcurrency ?? "Unknown", "client"),
      row("Memory (RAM)", hardware.deviceMemoryGB ? `${hardware.deviceMemoryGB} GB` : "Unknown", "client"),
      row("Max Touch Points", hardware.maxTouchPoints ?? "Unknown", "client"),
      row("Bluetooth", caps.present?.some((a) => a.key === "bluetooth") ? "Supported" : "Not supported", "client"),
      row("Bluetooth Adapter", "Unknown", "permission", "Web Bluetooth requires permission to enumerate devices."),
      row("Device Orientation", motion.eventsReceived ? `${motion.eventsReceived} events received` : "Not supported or blocked", "client"),
      row("Device Motion", motion.support?.motion ? "Supported" : "Not supported", "client"),
      row("Device Pointing Method", hardware.maxTouchPoints > 0 ? "Touchscreen" : "Mouse", "client"),
      row("Battery Level", "Unknown", "blocked", "Battery Status API removed from Firefox and Safari."),
      row("Battery Charging", "Unknown", "blocked"),
    ]);
    emit(sec);
  }

  // ---- Software surface ------------------------------------------------
  {
    const sec = section("Software Surface",
      "Plugins, MIME types, fonts and speech. Each is a build and platform signal.");

    addRows(sec, [
      row("Browser Plugins", plugins.pluginCount ?? 0, "client"),
      row("Plugin Details", plugins.plugins?.length ? plugins.plugins.map((p) => p.name).join(", ") : "None", "client"),
      row("MIME Types", plugins.mimeTypeCount ?? 0, "client"),
      row("Java", plugins.javaEnabled === false ? "Not installed / not supported" : "Unknown", "client"),
      row("ActiveX", plugins.activeXSupported ? "Supported" : "Not supported (not IE)", "client"),
      row("Fonts Detected", val("fonts", "detected") ?? "Unknown", "client"),
      row("Font List", val("fonts", "fontList")?.length ? `${val("fonts", "fontList").length} fonts` : "Unknown", "client"),
      row("SpeechSynthesis", "Supported", "client"),
      row("Speech Voices", val("speech", "count") ?? "Unknown", "client"),
      row("Voice Languages", val("speech", "languages")?.join(", ") || "Unknown", "client"),
      row("API Surface", features.summary ? `${features.summary.jsApisPresent} JS APIs, ${features.summary.cssFeaturesPresent} CSS features` : "Unknown", "client"),
    ]);
    emit(sec);
  }

  // ---- Display ---------------------------------------------------------
  {
    const sec = section("Display & Viewport",
      "Screen geometry and window size. Low effort, high value — and consistent across visits.");

    const s = display.screen || {};
    const w = display.window || {};

    addRows(sec, [
      row("Orientation", display.orientation?.type || "Unknown", "client"),
      row("Resolution", s.width && s.height ? `${s.width} x ${s.height} (pixels)` : "Unknown", "client"),
      row("Aspect Ratio", s.width && s.height ? (() => {
        const g = gcd(s.width, s.height);
        return `${s.width / g}:${s.height / g}`;
      })() : "Unknown", "client"),
      row("Device Pixel Ratio", w.devicePixelRatio ?? "Unknown", "client"),
      row("Color Depth", s.colorDepth ? `${s.colorDepth}-bit` : "Unknown", "client"),
      row("Pixel Depth", s.pixelDepth ? `${s.pixelDepth}-bit` : "Unknown", "client"),
      row("Window Outer", w.outerWidth && w.outerHeight ? `${w.outerWidth} x ${w.outerHeight}` : "Unknown", "client"),
      row("Window Inner", w.innerWidth && w.innerHeight ? `${w.innerWidth} x ${w.innerHeight}` : "Unknown", "client"),
      row("Full Screen Mode", document.fullscreenElement ? "Yes" : "No", "client"),
    ]);
    emit(sec);
  }

  // ---- Storage ---------------------------------------------------------
  {
    const sec = section("Storage & Persistence",
      "Which storage mechanisms exist and how much room they have. The quota is a fraction of free disk in most engines.");

    addRows(sec, [
      row("IndexedDB", storage.mechanisms?.indexedDB ? "Allowed" : "Not allowed", "client"),
      row("Local Storage", storage.mechanisms?.localStorage ? "Allowed" : "Not allowed", "client"),
      row("Session Storage", storage.mechanisms?.sessionStorage ? "Allowed" : "Not allowed", "client"),
      row("Cookies", hardware.cookieEnabled ? "Enabled" : "Disabled", "client"),
      row("Storage Quota", storage.estimate?.quotaGB ? `${storage.estimate.quotaGB} GB` : "Unknown", "client"),
      row("Storage Used", storage.estimate?.usageGB ? `${storage.estimate.usageGB} GB` : "Unknown", "client"),
      row("Persisted", storage.persisted === true ? "Yes" : "No", "client"),
    ]);
    emit(sec);
  }

  // ---- Page context ----------------------------------------------------
  {
    const sec = section("Page Context",
      "What the page knows about itself — referrer, visibility, scroll, and the live interaction state.");

    addRows(sec, [
      row("Page Referrer", document.referrer || "(none)", "client"),
      row("Page Load Time", perf.breakdown?.loadEventMs != null ? `${perf.breakdown.loadEventMs} ms` : "Unknown", "client"),
      row("Network Time", perf.breakdown?.dnsLookupMs != null
        ? `${(perf.breakdown.dnsLookupMs + (perf.breakdown.tcpConnectionMs || 0) + (perf.breakdown.serverResponseMs || 0) + (perf.breakdown.pageDownloadMs || 0)).toFixed(1)} ms`
        : "Unknown", "client"),
      row("Server Response Time", perf.breakdown?.serverResponseMs != null ? `${perf.breakdown.serverResponseMs} ms` : "Unknown", "client"),
      row("DNS Lookup Time", perf.breakdown?.dnsLookupMs != null ? `${perf.breakdown.dnsLookupMs} ms` : "Unknown", "client"),
      row("TCP Connection Time", perf.breakdown?.tcpConnectionMs != null ? `${perf.breakdown.tcpConnectionMs} ms` : "Unknown", "client"),
      row("HTTP Protocol", perf.protocol || "Unknown", "client"),
      row("Transfer Size", perf.transferSizeBytes ? `${perf.transferSizeBytes} bytes` : "Unknown", "client"),
      row("Page Visibility", document.visibilityState, "client"),
      row("Scroll Position", interaction.scroll ? `x: ${interaction.scroll.x}, y: ${interaction.scroll.y}` : "Unknown", "client"),
      row("Last Key Pressed", interaction.lastKey || "None", "client"),
      row("Caps Lock", interaction.capsLock === true ? "On" : interaction.capsLock === false ? "Off" : "Unknown", "client"),
      row("Mouse Position", interaction.mousePosition?.x != null
        ? `x: ${interaction.mousePosition.x}, y: ${interaction.mousePosition.y}`
        : "Unknown", "client"),
      row("Pop-up Windows", interaction.popupsBlocked === false ? "Allowed" : "Blocked", "client"),
      row("JavaScript Enabled", "Yes", "client"),
      row("WebRTC", "Enabled", "client"),
      row("WebSocket", features.vectors?.window ? (features.vectors.window.present.includes("WebSocket") ? "Supported" : "Not supported") : "Unknown", "client"),
    ]);
    emit(sec);
  }

  // ---- Server-only -----------------------------------------------------
  {
    const sec = section("Server-Side Only",
      "These fields appear on device-info sites but cannot be detected from the browser. They require the server to observe the connection.");

    addRows(sec, [
      row("IP Address (WAN)", "IPv6 / IPv4", "server"),
      row("Geolocation", "Country, region, city, lat/long", "server"),
      row("ISP", "Internet service provider", "server"),
      row("Nameservers", "DNS resolver configuration", "server"),
      row("Hostname", "Reverse DNS", "server"),
      row("Tor IP Address", "Exit node detection", "server"),
      row("VPN IP Address", "VPN detection", "server"),
      row("Proxy IP Address", "Proxy detection", "server"),
      row("HTTP Request Headers", "Accept, Accept-Encoding, Sec-CH-UA, …", "server"),
      row("TLS / SSL Protocol", "TLS version, cipher suite", "server"),
      row("HTTP Version", "HTTP/1.1, HTTP/2, HTTP/3", "server"),
      row("Connection Type (WAN)", "Broadband, fiber, cellular", "server"),
      row("Browser Build Number", "Chromium commit hash", "server"),
      row("Tab Previous Name", "Previous page title", "server"),
      row("Content Filtering", "DNS-level filtering", "server"),
      row("Server Address", "Host the page was served from", "server"),
    ]);
    emit(sec);
  }

  finish();
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}
