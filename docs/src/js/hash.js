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

/**
 * Deterministic JSON. Object keys are sorted so that two structurally
 * identical results always produce the same string regardless of insertion
 * order -- which matters because probe order is not guaranteed.
 */
export function stableStringify(value) {
  const seen = new Set();

  function walk(node) {
    if (node === null || typeof node !== "object") {
      if (typeof node === "bigint") return node.toString();
      if (typeof node === "function") return "[function]";
      if (node === undefined) return null;
      return node;
    }
    if (seen.has(node)) return "[circular]";
    seen.add(node);
    try {
      if (Array.isArray(node)) return node.map(walk);
      const out = {};
      for (const key of Object.keys(node).sort()) {
        const v = walk(node[key]);
        if (v !== undefined) out[key] = v;
      }
      return out;
    } finally {
      seen.delete(node);
    }
  }

  return JSON.stringify(walk(value));
}

/** Short display form of a hash: first 16 hex chars, grouped for readability. */
export function shortHash(hex, groups = 4) {
  if (!hex) return "—";
  const part = hex.slice(0, groups * 4);
  return (part.match(/.{4}/g) || []).join(" ");
}
