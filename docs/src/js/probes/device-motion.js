/**
 * Device motion and orientation.
 *
 * On a phone these are rich signals. On a desktop they are almost always
 * absent — which is itself the signal, and the reason this probe is worth
 * running on a laptop: a desktop reporting accelerometer data is either a
 * 2-in-1 with sensors or a spoofed fingerprint.
 *
 * iOS 13+ requires DeviceOrientationEvent.requestPermission() before any event
 * fires. That is a user gesture, so it is never requested here — the probe
 * reports support and whether events arrive unprompted.
 */
export const probe = {
  id: "device-motion",
  label: "Device motion & orientation",
  family: "hardware",
  bits: 2.0,
  async run() {
    const support = {
      orientation: typeof DeviceOrientationEvent === "function",
      motion: typeof DeviceMotionEvent === "function",
      compass: typeof DeviceOrientationEvent === "function" &&
        typeof DeviceOrientationEvent.requestPermission === "function",
    };

    if (!support.orientation && !support.motion) {
      return {
        available: true,
        support,
        eventsReceived: 0,
        note:
          "No motion sensors reported. Expected on a desktop; on a phone " +
          "this means the browser is withholding them.",
      };
    }

    // Listen briefly. Events that arrive without a prompt are the signal.
    const samples = [];
    const onOrientation = (e) => {
      if (samples.length < 5) {
        samples.push({
          alpha: e.alpha,
          beta: e.beta,
          gamma: e.gamma,
          absolute: e.absolute,
        });
      }
    };
    window.addEventListener("deviceorientation", onOrientation, { once: false });

    await new Promise((resolve) => setTimeout(resolve, 1200));
    window.removeEventListener("deviceorientation", onOrientation);

    return {
      available: true,
      support,
      eventsReceived: samples.length,
      samples,
      note:
        samples.length === 0
          ? "Sensors exist but no events arrived without a prompt. Normal on desktop; on mobile this means permission is required."
          : "Sensor events arrived unprompted. On a desktop this is unusual and worth noting.",
    };
  },
};
