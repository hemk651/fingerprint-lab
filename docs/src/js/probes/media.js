/**
 * Media codec support and speech synthesis voices.
 *
 * Codec support is gated by build flags, hardware decoders and licensing --
 * a page can tell a licensed-Chrome from an open build, or a phone with a
 * hardware H.265 decoder from one without, purely from `canPlayType`.
 *
 * The speech voice list is a surprisingly effective signal on desktop:
 * different operating systems and language packs ship different voices, and
 * the list is stable per machine.
 */

const MEDIA_TYPES = [
  'audio/aac', 'audio/flac', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/opus',
  'audio/wav', 'audio/webm', 'audio/x-m4a',
  'video/mp4; codecs="avc1.42E01E"', 'video/mp4; codecs="avc1.4D401E"',
  'video/mp4; codecs="avc1.640028"', 'video/mp4; codecs="hvc1.1.6.L93.B0"',
  'video/mp4; codecs="hev1.1.6.L93.B0"', 'video/mp4; codecs="av01.0.05M.08"',
  'video/mp4; codecs="vp09.00.10.08"', 'video/webm; codecs="vp8"',
  'video/webm; codecs="vp9"', 'video/ogg; codecs="theora"', 'video/quicktime',
  'video/x-matroska; codecs="avc1"',
];

const RECORDER_TYPES = [
  "audio/webm", "audio/webm;codecs=opus", "audio/ogg;codecs=opus",
  "audio/mp4", "audio/mp4;codecs=mp4a.40.2", "video/webm;codecs=vp8",
  "video/webm;codecs=vp9", "video/mp4;codecs=avc1.42E01E",
  "video/x-matroska;codecs=avc1",
];

function canPlayType(type) {
  const el = document.createElement("video");
  if (typeof el.canPlayType !== "function") return null;
  const result = el.canPlayType(type);
  return result === "" ? null : result;
}

export const probe = {
  id: "media",
  label: "Media codecs",
  family: "software",
  bits: 2.8,
  async run() {
    const supported = {};
    const maybe = [];
    for (const type of MEDIA_TYPES) {
      const result = canPlayType(type);
      if (result === "probably") supported[type] = "probably";
      else if (result === "maybe") maybe.push(type);
    }

    let recorder = { supported: [], unsupported: [] };
    if (window.MediaRecorder && typeof MediaRecorder.isTypeSupported === "function") {
      for (const type of RECORDER_TYPES) {
        (MediaRecorder.isTypeSupported(type) ? recorder.supported : recorder.unsupported).push(type);
      }
    }

    let audioDecoding = null;
    if (window.AudioDecoder || window.VideoDecoder) {
      audioDecoding = {
        audio: typeof window.AudioDecoder === "function",
        video: typeof window.VideoDecoder === "function",
      };
    }

    return {
      available: MEDIA_TYPES.length > 0,
      definitelySupported: supported,
      maybeSupported: maybe,
      recorder,
      webCodecs: audioDecoding,
      summary: {
        definite: Object.keys(supported).length,
        maybe: maybe.length,
        recorder: recorder.supported.length,
      },
      note:
        "`maybe` is kept separate from `probably`: the spec deliberately "
        + "returns an ambiguous value, and treating the two as the same is a "
        + "common error in fingerprinting code.",
    };
  },
};
