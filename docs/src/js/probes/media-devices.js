/**
 * Media device enumeration.
 *
 * `enumerateDevices()` returns device kinds and counts without any permission.
 * Labels are redacted until the user grants access, so a page can learn "you
 * have exactly one microphone and one camera" while learning nothing about
 * what those devices are called. That asymmetry is the interesting part.
 */
export const probe = {
  id: "media-devices",
  label: "Speakers, microphones & cameras",
  family: "hardware",
  bits: 2.5,
  async run() {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.enumerateDevices !== "function") {
      return { available: false, note: "MediaDevices API unavailable." };
    }

    let devices = [];
    try {
      devices = await navigator.mediaDevices.enumerateDevices();
    } catch (err) {
      return { available: false, note: `enumerateDevices refused: ${err.message}` };
    }

    const speakers = devices.filter((d) => d.kind === "audiooutput");
    const microphones = devices.filter((d) => d.kind === "audioinput");
    const cameras = devices.filter((d) => d.kind === "videoinput");

    const labelled = devices.filter((d) => d.label && d.label.length > 0).length;

    return {
      available: true,
      totalDevices: devices.length,
      speakers: speakers.length,
      microphones: microphones.length,
      cameras: cameras.length,
      labelsRevealed: labelled,
      labelsRedacted: devices.length - labelled,
      devices: devices.map((d) => ({
        kind: d.kind,
        label: d.label || "(redacted)",
        groupId: d.groupId ? "present" : "absent",
      })),
      note:
        "Counts are available without permission. Labels are redacted until " +
        "the user grants access — a page can learn how many microphones you " +
        "have without learning anything about them.",
    };
  },
};
