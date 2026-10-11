/**
 * Probe registry.
 *
 * Every module in this directory exports a `probe` object. Adding a new signal
 * means adding a file and one line here -- the entropy model, the renderer and
 * the export all pick it up automatically.
 *
 * Order matters for presentation only: the renderer groups by family.
 */

import { probe as browserDetection } from "./browser-detection.js";
import { probe as identity } from "./identity.js";
import { probe as locale } from "./locale.js";
import { probe as display } from "./display.js";
import { probe as hardware } from "./hardware.js";
import { probe as canvas } from "./canvas.js";
import { probe as webgl } from "./webgl.js";
import { probe as audio } from "./audio.js";
import { probe as fonts } from "./fonts.js";
import { probe as features } from "./features.js";
import { probe as media } from "./media.js";
import { probe as speech } from "./speech.js";
import { probe as permissions } from "./permissions.js";
import { probe as storage } from "./storage.js";
import { probe as network } from "./network.js";
import { probe as webrtc } from "./webrtc.js";
import { probe as math } from "./math.js";
import { probe as timing } from "./timing.js";
import { probe as clientHints } from "./client-hints.js";
import { probe as mediaDevices } from "./media-devices.js";
import { probe as deviceCapabilities } from "./device-capabilities.js";
import { probe as deviceMotion } from "./device-motion.js";
import { probe as pluginsMime } from "./plugins-mime.js";
import { probe as privacySignals } from "./privacy-signals.js";
import { probe as adblockDetect } from "./adblock-detect.js";
import { probe as performanceDetail } from "./performance-detail.js";
import { createPageInteractionProbe } from "./page-interaction.js";

export const PROBES = [
  browserDetection,
  identity,
  locale,
  display,
  hardware,
  canvas,
  webgl,
  audio,
  fonts,
  features,
  media,
  speech,
  permissions,
  storage,
  network,
  webrtc,
  math,
  timing,
  clientHints,
  mediaDevices,
  deviceCapabilities,
  deviceMotion,
  pluginsMime,
  privacySignals,
  adblockDetect,
  performanceDetail,
  createPageInteractionProbe(),
];

export const PROBE_IDS = PROBES.map((p) => p.id);

/** Look up the declared metadata for a probe id. */
export function metaFor(id) {
  return PROBES.find((p) => p.id === id) || null;
}
