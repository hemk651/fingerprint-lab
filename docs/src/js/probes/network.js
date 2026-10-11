/**
 * Network class and clock behaviour.
 *
 * `navigator.connection` reports a coarse effective connection type and, on
 * Chrome, a measured downlink and round-trip time. Downlink is quantised to
 * 25 kbps steps and rounds to a few hundred bits of entropy at most, but it
 * is stable and it is a *real* property of the connection rather than the
 * machine.
 *
 * The timing block measures how precisely this page can observe time, which
 * is the thing cross-origin timing attacks exploit -- reported here because
 * "how much a page can measure about you" includes how well it can measure.
 */

export const probe = {
  id: "network",
  label: "Network class",
  family: "network",
  bits: 1.6,
  async run() {
    const conn =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;

    if (!conn) {
      return {
        available: false,
        note: "NetworkInformation API unavailable.",
        online: navigator.onLine === true,
      };
    }

    return {
      available: true,
      online: navigator.onLine === true,
      effectiveType: conn.effectiveType ?? null,
      type: conn.type ?? null,
      downlinkMbps: conn.downlink ?? null,
      downlinkMaxMbps: conn.downlinkMax ?? null,
      rttMs: conn.rtt ?? null,
      saveData: conn.saveData ?? null,
      note:
        "Downlink is a measured estimate, not a declared value, so it drifts "
        + "between visits. Treat it as a weak signal.",
    };
  },
};
