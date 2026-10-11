/**
 * Entropy model.
 *
 * IMPORTANT -- read this before quoting any number from this file.
 *
 * The per-signal bit values below are *assumed* values drawn from the range
 * published in the fingerprinting literature (EFF's Panopticlick work and
 * later measurements). They are not measured from a real population, because
 * this page never leaves one browser. The bit values are therefore an
 * illustrative allocation, not an observation.
 *
 * Naively summing them overstates the answer badly. Real signals are heavily
 * correlated: a Windows machine with a discrete NVIDIA GPU and an English
 * locale will predict much of its own canvas, font list and User-Agent string.
 * The model below handles this by grouping signals into families, discounting
 * each family for internal correlation, and then discounting the combination
 * of families for cross-family correlation.
 *
 * The result lands in the 25-40 bit band that published full-vector
 * measurements report, which is the honest target. Treat any specific figure
 * as "same order of magnitude as published estimates", not as a measurement.
 */

export const FAMILIES = {
  platform: {
    label: "Platform & environment",
    blurb: "What the machine is. Strongly correlated with each other.",
    redundancy: 0.6,
  },
  rendering: {
    label: "Rendering pipeline",
    blurb: "GPU, rasteriser and font rasterisation output.",
    redundancy: 0.75,
  },
  software: {
    label: "Software surface",
    blurb: "Which APIs and codecs this build exposes.",
    redundancy: 0.65,
  },
  hardware: {
    label: "Hardware & sensors",
    blurb: "Physical capabilities: cores, GPU, media devices, sensors.",
    redundancy: 0.7,
  },
  privacy: {
    label: "Privacy & blocking",
    blurb: "What the user or browser is withholding.",
    redundancy: 0.75,
  },
  network: {
    label: "Network & timing",
    blurb: "Connection class and clock behaviour.",
    redundancy: 0.8,
  },
  behaviour: {
    label: "Interaction behaviour",
    blurb: "How the visitor is using the page right now.",
    redundancy: 0.8,
  },
};

// Correlation left over once the families are combined. A Windows/NVIDIA/GPU
// correlation still predicts part of the rendering family, for instance.
const CROSS_FAMILY = 0.85;

/**
 * @param {Array<{id:string, family:string, bits:number, available:boolean}>} signals
 * @returns {{families:Array, crossFamilyFactor:number, total:number, nominalTotal:number}}
 */
export function modelEntropy(signals) {
  const buckets = {};
  for (const key of Object.keys(FAMILIES)) {
    buckets[key] = { key, nominal: 0, modelled: 0, count: 0 };
  }

  for (const s of signals) {
    // Unavailable signals contribute nothing: a blocked canvas is not a
    // signal about the visitor, it is a signal about the browser policy.
    if (!s.available) continue;
    if (!buckets[s.family]) continue;
    buckets[s.family].nominal += s.bits;
    buckets[s.family].count += 1;
  }

  const families = Object.values(buckets)
    .filter((b) => b.count > 0)
    .map((b) => ({
      ...b,
      label: FAMILIES[b.key].label,
      blurb: FAMILIES[b.key].blurb,
      redundancy: FAMILIES[b.key].redundancy,
      modelled: b.nominal * FAMILIES[b.key].redundancy,
    }));

  const summed = families.reduce((acc, f) => acc + f.modelled, 0);
  const crossFamilyFactor = families.length > 1 ? CROSS_FAMILY : 1;

  const nominalTotal = signals.reduce((acc, s) => acc + (s.available ? s.bits : 0), 0);

  return {
    families,
    crossFamilyFactor,
    total: summed * crossFamilyFactor,
    nominalTotal,
    discardedBits: nominalTotal - summed * crossFamilyFactor,
  };
}

// World population, used to frame the "1 in N" figure. 8.2 billion is 32.9
// bits: any fingerprint above that line has no twin.
const WORLD_POPULATION = 8.2e9;
const WORLD_POPULATION_BITS = Math.log2(WORLD_POPULATION);

/** Number of equally likely fingerprints a `bits`-bit value distinguishes. */
export function populationOf(bits) {
  return Math.pow(2, bits);
}

const UNITS = [
  { limit: 1e12, div: 1e12, name: "trillion" },
  { limit: 1e9, div: 1e9, name: "billion" },
  { limit: 1e6, div: 1e6, name: "million" },
  { limit: 1e4, div: 1e3, name: "thousand" },
];

function humanCount(n) {
  for (const unit of UNITS) {
    if (n >= unit.limit) {
      const scaled = n / unit.div;
      // Past the top bucket, say so rather than printing twenty digits.
      if (scaled >= 1000) return "over 1,000 trillion";
      return `${Number(scaled.toPrecision(2)).toLocaleString("en-US")} ${unit.name}`;
    }
  }
  return Math.round(n).toLocaleString("en-US");
}

export function formatPopulation(bits) {
  return humanCount(populationOf(bits));
}

export function tierOf(bits) {
  if (bits < 12) {
    return {
      label: "Blends in",
      tone: "good",
      blurb: "Fewer than a few thousand people worldwide would share this.",
    };
  }
  if (bits < 20) {
    return {
      label: "Common",
      tone: "good",
      blurb: "One of a large crowd. Tracking would need other data to pin you down.",
    };
  }
  if (bits < 27) {
    return {
      label: "Distinguishable",
      tone: "warn",
      blurb: "Numbers in the millions. Trackable in aggregation, noisy alone.",
    };
  }
  if (bits < 33) {
    return {
      label: "Near-unique",
      tone: "warn",
      blurb: "Billions of combinations. Effectively trackable across the web.",
    };
  }
  return {
    label: "Unique",
    tone: "bad",
    blurb: "Beyond the world population. This fingerprint stands alone.",
  };
}

/** Two people drawn at random collide with probability 1 / 2^bits. */
export function shareFrame(bits) {
  if (bits >= WORLD_POPULATION_BITS) {
    return "There are more possible fingerprints than people. This one has no twin.";
  }
  return `About 1 in ${formatPopulation(bits)} people shares this fingerprint.`;
}

export { WORLD_POPULATION_BITS };

