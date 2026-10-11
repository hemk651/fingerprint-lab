/**
 * Screen, window and CSS preferences.
 *
 * Screen geometry plus devicePixelRatio is one of the highest-value low-effort
 * signals, and it does not need any API -- it is layout information the page
 * needs in order to render at all. The media query block captures rendering
 * preferences (contrast, motion, colour gamut) that are handed over for
 * accessibility reasons and are rarely uniform across a population.
 */
const MEDIA_QUERIES = [
  "prefers-color-scheme",
  "prefers-reduced-motion",
  "prefers-reduced-transparency",
  "prefers-contrast",
  "forced-colors",
  "inverted-colors",
  "dynamic-range",
  "video-dynamic-range",
  "color-gamut",
  "any-pointer",
  "any-hover",
  "pointer",
  "hover",
  "orientation",
  "display-mode",
];

export const probe = {
  id: "display",
  label: "Display, viewport & rendering preferences",
  family: "platform",
  bits: 5.4,
  async run() {
    const s = screen;
    const mq = {};
    for (const query of MEDIA_QUERIES) {
      try {
        const list = matchMedia(`(${query})`);
        mq[query] = { matches: list.matches, media: list.media };
      } catch {
        mq[query] = { matches: null, media: null };
      }
    }

    const orientation = screen.orientation;
    return {
      screen: {
        width: s.width,
        height: s.height,
        availWidth: s.availWidth,
        availHeight: s.availHeight,
        colorDepth: s.colorDepth,
        pixelDepth: s.pixelDepth,
      },
      window: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
        screenX: window.screenX,
        screenY: window.screenY,
        devicePixelRatio: window.devicePixelRatio,
      },
      orientation: orientation
        ? { type: orientation.type, angle: orientation.angle }
        : null,
      mediaQueries: mq,
    };
  },
};
