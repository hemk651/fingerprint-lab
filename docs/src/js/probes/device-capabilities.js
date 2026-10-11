/**
 * Hardware capability surface.
 *
 * Which hardware APIs this browser exposes. Each one is a build and platform
 * signal: Web Bluetooth exists on Android and desktop Chromium but not iOS
 * Safari; Web NFC is Android-only; Web Serial is desktop-only. The pattern of
 * presence and absence narrows the platform considerably.
 *
 * Presence is not access. Every one of these requires a permission prompt
 * before it touches a device — the probe only checks that the API exists.
 */
const APIS = [
  { key: "bluetooth", label: "Web Bluetooth", hint: "Android / desktop Chromium" },
  { key: "serial", label: "Web Serial", hint: "Desktop Chromium" },
  { key: "usb", label: "Web USB", hint: "Desktop Chromium" },
  { key: "nfc", label: "Web NFC", hint: "Android Chromium only" },
  { key: "hid", label: "Web HID", hint: "Desktop Chromium" },
  { key: "wakeLock", label: "Screen Wake Lock", hint: "Widely supported" },
  { key: "share", label: "Web Share", hint: "Mobile-first" },
  { key: "contacts", label: "Contact Picker", hint: "Android / Chrome OS" },
  { key: "gamepad", label: "Gamepad", hint: "Desktop" },
  { key: "xr", label: "WebXR", hint: "VR/AR capable" },
  { key: "presentation", label: "Presentation API", hint: "Desktop" },
  { key: "clipboard", label: "Async Clipboard", hint: "Widely supported" },
  { key: "credentials", label: "Credential Management", hint: "Widely supported" },
  { key: "keyboard", label: "Keyboard API", hint: "Desktop Chromium" },
  { key: "locks", label: "Web Locks", hint: "Chromium" },
  { key: "scheduling", label: "Web Scheduling", hint: "Chromium" },
  { key: "storageBuckets", label: "Storage Buckets", hint: "Chromium" },
  { key: "ai", label: "Web AI / Prompt API", hint: "Chrome 128+ (experimental)" },
];

export const probe = {
  id: "device-capabilities",
  label: "Hardware capability surface",
  family: "hardware",
  bits: 3.0,
  async run() {
    const present = [];
    const absent = [];
    for (const api of APIS) {
      const exists = api.key in navigator || api.key in window;
      (exists ? present : absent).push({ ...api });
    }

    return {
      available: true,
      presentCount: present.length,
      absentCount: absent.length,
      present,
      absent,
      note:
        "API presence is a platform and build signal. Web NFC existing at " +
        "all means Android Chromium; Web Serial means desktop. None of these " +
        "were accessed — presence is not permission.",
    };
  },
};
