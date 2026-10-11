/**
 * Clock precision.
 *
 * Reported because "what a page can learn about you" includes how well it can
 * measure you: high-resolution timers are the substrate of cache-timing and
 * cross-origin side-channel attacks. Browsers coarsen or jitter them in
 * response; measuring the residual resolution shows what that mitigation
 * actually bought.
 */

export const probe = {
  id: "timing",
  label: "Clock precision",
  family: "network",
  bits: 0.9,
  async run() {
    const results = {
      performanceNowMs: Math.round(performance.now() * 1000) / 1000,
      dateCoarsened: (() => {
        // A few hundred samples taken in a tight loop. If Date.now() never
        // moves, it has been coarsened rather than merely slow.
        const samples = new Set();
        for (let i = 0; i < 500; i++) samples.add(Date.now());
        return samples.size === 1;
      })(),
    };

    const nav = performance.getEntriesByType?.("navigation")?.[0];
    if (nav) {
      results.navigation = {
        type: nav.type,
        protocol: nav.nextHopProtocol ?? null,
        transferSizeBytes: nav.transferSize ?? null,
        domContentLoadedMs: Number(
          (nav.domContentLoadedEventEnd - nav.startTime).toFixed(3)
        ),
        loadEventMs: Number((nav.loadEventEnd - nav.startTime).toFixed(3)),
      };
    }

    // Mean gap between distinct performance.now() readings: the resolution
    // the page is actually left with.
    const gaps = [];
    let last = performance.now();
    for (let i = 0; i < 20000; i++) {
      const now = performance.now();
      if (now !== last) {
        gaps.push(Number(((now - last) * 1e6).toFixed(3)));
        last = now;
        if (gaps.length >= 20) break;
      }
    }
    results.nowResolutionUs =
      gaps.length > 0
        ? Number((gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(3))
        : null;
    results.samplesTaken = gaps.length;

    return {
      available: true,
      ...results,
      note:
        "Cross-origin timing is coarsened or jittered in current browsers; "
        + "what remains is the local clock resolution, which is all a "
        + "same-page measurement can use anyway.",
    };
  },
};
