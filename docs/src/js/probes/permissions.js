/**
 * Permission *states*.
 *
 * This is the distinction that matters most for the ethics of this page, and
 * the one most often blurred.
 *
 * `navigator.permissions.query()` reads the current state of a permission
 * without asking for it. "granted" and "denied" are therefore genuinely
 * observable -- a page can tell that you have permanently blocked location
 * without ever prompting. "prompt" (the usual answer) tells the page nothing
 * about you beyond the fact you have not decided yet.
 *
 * Nothing here is *requested*. No dialog appears. No callback is registered.
 * The states are reported so the difference is visible rather than theoretical.
 */

/**
 * Names safe to query without prompting. Notification and push do prompt on
 * some engines, so they are deliberately excluded.
 */
const QUERYABLE = [
  "geolocation",
  "notifications-state", // resolved below, guarded
  "camera-state",
  "microphone-state",
  "clipboard-read",
  "clipboard-write",
  "persistent-storage",
  "screen-wake-lock",
  "background-sync",
  "accelerometer",
  "gyroscope",
  "magnetometer",
  "ambient-light-sensor",
  "accessibility-events",
  "payment-handler",
  "local-fonts",
  "window-management",
  "midi",
];

export const probe = {
  id: "permissions",
  label: "Permission states (read, never requested)",
  family: "software",
  bits: 1.4,
  async run() {
    if (!navigator.permissions || typeof navigator.permissions.query !== "function") {
      return {
        available: false,
        note: "Permissions API unavailable -- states not observable.",
      };
    }

    const states = {};
    let queried = 0;
    let denied = 0;
    let granted = 0;

    await Promise.all(
      QUERYABLE.map(async (name) => {
        const target = name.replace(/-state$/, "");
        try {
          const status = await navigator.permissions.query({ name: target });
          states[target] = status.state;
          queried += 1;
          if (status.state === "denied") denied += 1;
          if (status.state === "granted") granted += 1;
        } catch {
          states[target] = "unsupported";
        }
      })
    );

    return {
      available: true,
      queried,
      granted,
      denied,
      states,
      note:
        "Read-only. No permission was requested and no prompt was shown. A "
        + "'denied' state is observable because a previous decision is stored "
        + "by the browser, not because this page asked. That asymmetry -- "
        + "past decisions are visible, future ones are not -- is the part "
        + "worth understanding.",
    };
  },
};
