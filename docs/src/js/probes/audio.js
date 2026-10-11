/**
 * AudioContext fingerprint.
 * An oscillator is rendered offline through a DynamicsCompressor node and the
 * resulting samples are summed. The compressor's curve is implemented
 * differently per engine and per platform, so identical input produces a
 * stable, platform-specific sample sequence.
 *
 * This is the probe that resistFingerprinting most reliably nullifies:
 * Firefox returns a constant buffer, and a null result is reported as such
 * rather than silently contributing zero entropy.
 */
import { sha256 } from "../hash.js";

export const probe = {
  id: "audio",
  label: "AudioContext processing",
  family: "rendering",
  bits: 5.0,
  async run() {
    const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Ctx) {
      return { available: false, note: "OfflineAudioContext unavailable." };
    }

    try {
      // 1 second of 44.1kHz is enough to capture the compressor curve.
      const ctx = new Ctx(1, 44100, 44100);

      const oscillator = ctx.createOscillator();
      oscillator.type = "triangle";
      oscillator.frequency.value = 10000;

      const compressor = ctx.createDynamicsCompressor();
      // Fixed settings so the difference is the implementation, not the input.
      compressor.threshold.value = -50;
      compressor.knee.value = 40;
      compressor.ratio.value = 12;
      compressor.attack.value = 0;
      compressor.release.value = 0.25;

      oscillator.connect(compressor);
      compressor.connect(ctx.destination);
      oscillator.start(0);

      const buffer = await ctx.startRendering();
      const channel = buffer.getChannelData(0);

      // Sum with a carry so ordering matters, not just magnitude.
      let sum = 0;
      let peaks = 0;
      for (let i = 0; i < channel.length; i++) {
        const v = channel[i];
        sum = (sum + v * 1e6) | 0;
        if (v !== 0) peaks++;
      }

      if (peaks === 0) {
        return {
          available: false,
          note:
            "Rendered buffer is entirely zero -- this browser is normalising "
            + "the audio pipeline against fingerprinting.",
        };
      }

      return {
        available: true,
        sampleLength: channel.length,
        sampleRate: buffer.sampleRate,
        nonZeroSamples: peaks,
        checksum: sum.toString(16),
        hash: await sha256(String(sum)),
      };
    } catch (err) {
      return { available: false, note: `Rendering refused: ${err.message}` };
    }
  },
};
