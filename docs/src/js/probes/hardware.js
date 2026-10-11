/**
 * Hardware capability hints.
 *
 * These are the values the browser volunteers so a page can size its work
 * sensibly. `hardwareConcurrency` is the thread count, `deviceMemory` is a
 * quantised RAM band, and `maxTouchPoints` separates touch hardware from
 * mouse hardware. None of them is an identifier alone, but together they cut
 * the population by a large factor and they are consistent across visits.
 */
export const probe = {
  id: "hardware",
  label: "Hardware hints",
  family: "platform",
  bits: 5.5,
  async run() {
    const n = navigator;
    return {
      hardwareConcurrency: n.hardwareConcurrency ?? null,
      deviceMemoryGB: "deviceMemory" in n ? n.deviceMemory : null,
      maxTouchPoints: n.maxTouchPoints ?? null,
      cookieEnabled: n.cookieEnabled === true,
      globalPrivacyControl: "globalPrivacyControl" in n ? n.globalPrivacyControl : null,
      doNotTrack: n.doNotTrack || null,
      javaEnabled: typeof n.javaEnabled === "function" ? n.javaEnabled() : null,
      // Mutable properties that are unusual but easy to observe.
      userAgentDataPresent: "userAgentData" in n,
    };
  },
};
