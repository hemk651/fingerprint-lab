/**
 * WebRTC local address exposure.
 *
 * This is the classic privacy incident. A page that opens an RTCPeerConnection
 * and gathers ICE candidates can historically read the machine's LAN IP
 * address -- sometimes the public one too, if a STUN server is reached. No
 * dialog was ever involved; the API was simply reachable.
 *
 * That hole is now mostly closed: Chrome and Safari replace local addresses
 * with an mDNS hostname (a random UUID ending in `.local`), and Firefox
 * withholds host candidates entirely unless a STUN server is configured.
 *
 * This probe therefore reports the *structure* of what the API exposes --
 * candidate types, whether an address is an mDNS placeholder or a real
 * address, how many candidates look like real local addresses -- and
 * deliberately does not record any address itself. Report the shape, not the
 * payload.
 *
 * No STUN server is contacted. An empty `iceServers` list means no srflx
 * candidate can be produced, so no external endpoint learns about this visit.
 */

export const probe = {
  id: "webrtc",
  label: "WebRTC address exposure",
  family: "network",
  bits: 2.0,
  async run() {
    if (typeof window.RTCPeerConnection !== "function") {
      return { available: false, note: "RTCPeerConnection unavailable." };
    }

    const timeout = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel("probe");

      const candidates = [];
      const seen = new Set();

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        const line = event.candidate.candidate || "";
        const type = line.split(/\s+/)[7] || "unknown";
        // The address field is position 4 in an a=candidate line.
        const addressField = line.split(/\s+/)[4] || "";
        const isMdns = /\.local$/.test(addressField);
        const isIpv6 = addressField.includes(":");
        const fingerprint = `${type}:${isMdns ? "mdns" : isIpv6 ? "real-v6" : addressField ? "real-v4" : "none"}`;
        seen.add(fingerprint);
        candidates.push({ type, obfuscated: isMdns });
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Gathering completes on its own schedule; wait then discard.
      await timeout(1200);

      // Close silently: nothing was sent anywhere.
      try {
        pc.close();
      } catch {
        /* already closed */
      }

      const types = {};
      for (const c of candidates) types[c.type] = (types[c.type] || 0) + 1;

      const obfuscated = candidates.filter((c) => c.obfuscated).length;
      const unObfuscated = candidates.length - obfuscated;
      const distinctShapes = Array.from(seen).sort();

      let exposure;
      if (candidates.length === 0) {
        exposure = "none";
      } else if (unObfuscated === 0) {
        exposure = "mdns-only";
      } else if (types.host && unObfuscated > 0) {
        exposure = "local-address-visible";
      } else {
        exposure = "partial";
      }

      return {
        available: true,
        exposure,
        candidateCount: candidates.length,
        candidateTypes: types,
        obfuscatedCount: obfuscated,
        unObfuscatedCount: unObfuscated,
        distinctShapes,
        note:
          "Addresses themselves are intentionally not recorded. The "
          + "obfuscated flag is set when a candidate address ends in "
          + "`.local`, which is Chrome's and Safari's mDNS placeholder.",
      };
    } catch (err) {
      return { available: false, note: `Setup refused: ${err.message}` };
    }
  },
};
