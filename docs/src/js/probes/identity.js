import { sha256 } from "../hash.js";

/**
 * Who the browser says it is.
 *
 * The User-Agent string is the single most quoted signal and also the least
 * trustworthy: Chrome froze it, Safari froze it, and every browser reports a
 * long tail of minor versions. It is reported here because it is easy to
 * compare against what the rest of the page reveals -- mismatches between
 * these values are themselves a signal.
 */
export const probe = {
  id: "identity",
  label: "Identity strings",
  family: "platform",
  bits: 8.0,
  async run() {
    const n = navigator;
    return {
      userAgent: n.userAgent || null,
      appVersion: n.appVersion || null,
      product: n.product || null,
      vendor: n.vendor || null,
      productSub: n.productSub || null,
      oscpu: "oscpu" in n ? n.oscpu : null,
      webdriver: n.webdriver === true,
      pdfViewerEnabled: n.pdfViewerEnabled === true,
      standalone: typeof n.standalone === "boolean" ? n.standalone : null,
      userAgentHash: await sha256(n.userAgent || ""),
    };
  },
};
