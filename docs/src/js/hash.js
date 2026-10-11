/**
 * Hashing and canonical serialisation.
 *
 * Everything here is synchronous except sha256, which uses SubtleCrypto when
 * it is available. Nothing in this module touches the network: hashing is a
 * local operation on strings the page already holds.
 */

const encoder = new TextEncoder();

/** 32-bit FNV-1a. The fallback when SubtleCrypto is unavailable (non-secure
 *  contexts, very old browsers). Weak, but this is a display hash, not a
 *  security boundary. */
export function fnv1a(input) {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // h *= 16777619, done as shifts to stay in 32 bits
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export async function sha256(input) {
  if (globalThis.crypto && crypto.subtle) {
    try {
      const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      // SubtleCrypto exists but refused; fall through to the weak hash.
    }
  }
  return fnv1a(input);
}
