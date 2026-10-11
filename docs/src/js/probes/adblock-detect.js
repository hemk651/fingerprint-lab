/**
 * Content blocker detection.
 *
 * Ad blockers and privacy extensions are detectable because they change the
 * page: they remove elements, block requests, and leave traces in the DOM.
 * This probe looks for those traces.
 *
 * The method is deliberately the simple one — create bait with names a blocker
 * targets, check whether it survived. More sophisticated blockers evade it,
 * which is why the result is reported as "detected / not detected" rather than
 * as a certainty.
 */

const BAIT_CLASSES = [
  "ad", "ads", "adsbox", "advertisement", "ad-banner", "ad-wrapper",
  "google-ad", "sponsor", "sponsored", "doubleclick", "googlesyndication",
];

function detectAdBlocker() {
  const bait = document.createElement("div");
  bait.className = BAIT_CLASSES.join(" ");
  bait.style.position = "absolute";
  bait.style.left = "-9999px";
  bait.style.height = "1px";
  bait.style.width = "1px";
  bait.innerHTML = "&nbsp;";
  document.body.appendChild(bait);

  let blocked = false;
  try {
    // If a blocker removed or hid the bait, offsetParent is null and
    // getBoundingClientRect collapses to zero.
    blocked =
      bait.offsetParent === null ||
      bait.getBoundingClientRect().height === 0 ||
      getComputedStyle(bait).display === "none" ||
      !document.body.contains(bait);
  } catch {
    blocked = false;
  } finally {
    document.body.removeChild(bait);
  }
  return blocked;
}

/** Ghostery ships specific DOM markers and blocks its own analytics. */
function detectGhostery() {
  const markers = [
    window.__gh__yt,
    window.Ghostery,
    window.ghostery,
  ];
  return markers.some((m) => m !== undefined) || Boolean(document.querySelector("[data-ghostery]"));
}

export const probe = {
  id: "adblock-detect",
  label: "Content blockers & extensions",
  family: "privacy",
  bits: 1.5,
  async run() {
    const adBlocked = detectAdBlocker();
    const ghostery = detectGhostery();

    return {
      available: true,
      adBlockerDetected: adBlocked,
      ghosteryDetected: ghostery,
      note:
        adBlocked
          ? "A bait element with ad-like class names was removed or hidden. Some content blocker is active."
          : "Bait survived. No classic ad blocker detected — though a sophisticated one may be evading this check.",
    };
  },
};
