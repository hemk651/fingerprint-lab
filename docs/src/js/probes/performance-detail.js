/**
 * Navigation Timing breakdown.
 *
 * The full page-load cost, decomposed. Every value here is something the
 * browser recorded about the request it just made — including DNS, TCP and
 * server response time, which are otherwise invisible to a page.
 *
 * `nextHopProtocol` is the interesting one: it reveals whether the connection
 * was HTTP/1.1, HTTP/2 or HTTP/3, which is normally only visible to the server.
 */
export const probe = {
  id: "performance-detail",
  label: "Page load timing",
  family: "network",
  bits: 1.5,
  async run() {
    const nav = performance.getEntriesByType?.("navigation")?.[0];
    if (!nav) {
      return { available: false, note: "Navigation Timing entry unavailable." };
    }

    const ms = (end, start) => Number(((end - start) || 0).toFixed(3));

    return {
      available: true,
      protocol: nav.nextHopProtocol || null,
      transferSizeBytes: nav.transferSize ?? null,
      bodySizeBytes: nav.encodedBodySize ?? null,
      breakdown: {
        dnsLookupMs: ms(nav.domainLookupEnd, nav.domainLookupStart),
        tcpConnectionMs: ms(nav.connectEnd, nav.connectStart),
        tlsHandshakeMs: nav.secureConnectionStart
          ? ms(nav.connectEnd, nav.secureConnectionStart)
          : 0,
        serverResponseMs: ms(nav.responseStart, nav.requestStart),
        pageDownloadMs: ms(nav.responseEnd, nav.responseStart),
        domInteractiveMs: ms(nav.domInteractive, nav.startTime),
        domContentLoadedMs: ms(nav.domContentLoadedEventEnd, nav.startTime),
        loadEventMs: ms(nav.loadEventEnd, nav.startTime),
        redirectMs: nav.redirectCount ? ms(nav.redirectEnd, nav.redirectStart) : 0,
      },
      note:
        "DNS, TCP and server response times are recorded by the browser for " +
        "its own request. nextHopProtocol reveals HTTP/2 or HTTP/3 — normally " +
        "a server-only observation.",
    };
  },
};
