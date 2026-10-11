/**
 * Rendering.
 *
 * Pure DOM construction -- no template strings injected via innerHTML for
 * probe data, because probe output is untrusted input by definition (it
 * contains arbitrary strings from the platform). Everything goes through
 * textContent or explicit attribute creation.
 */

import { FAMILIES, formatPopulation, shareFrame, tierOf } from "./entropy.js";

const el = (tag, className, content) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content instanceof Node) {
    // Passing a node in. textContent would stringify it to
    // "[object HTMLDetailsElement]", which is how every nested value used to
    // render before this check existed.
    node.append(content);
  } else if (content !== undefined && content !== null) {
    node.textContent = String(content);
  }
  return node;
};

/**
 * Render a value as readable DOM. Objects and arrays recurse; long lists are
 * collapsed behind a details node so the page stays usable.
 */
function valueNode(label, value, depth = 0) {
  const row = el("div", "row");

  if (value === null || value === undefined) {
    row.append(el("dt", "row-key", label), el("dd", "row-val muted", "absent"));
    return row;
  }

  if (typeof value === "object") {
    const isArr = Array.isArray(value);
    const entries = isArr
      ? value.map((v, i) => [String(i), v])
      : Object.entries(value);
    const summary = isArr ? `${value.length} items` : `${entries.length} keys`;

    if (depth >= 3 || entries.length > 40) {
      // Deep or wide: show a collapsed JSON blob rather than a nested tree.
      const details = el("details", "collapsed");
      details.append(el("summary", null, `${summary} — expand`));
      const pre = el("pre", "json", JSON.stringify(value, null, 2));
      details.append(pre);
      row.append(el("dt", "row-key", label), el("dd", "row-val", details));
      return row;
    }

    const nested = el("dl", "sublist");
    for (const [k, v] of entries) {
      nested.append(valueNode(k, v, depth + 1));
    }
    const details = el("details", "collapsed");
    details.append(el("summary", null, `${summary} — expand`));
    details.append(nested);
    row.append(el("dt", "row-key", label), el("dd", "row-val", details));
    return row;
  }

  const display = typeof value === "boolean" ? (value ? "yes" : "no") : value;
  const dd = el("dd", "row-val", display);
  row.append(el("dt", "row-key", label), dd);
  return row;
}

function signalCard(signal, meta, entropy) {
  const card = el("article", "card");
  card.dataset.signal = signal.id;

  const head = el("header", "card-head");
  head.append(
    el("h3", "card-title", meta.label),
    el("span", "bits", `${meta.bits.toFixed(1)} b`)
  );
  card.append(head);

  if (!signal.available) {
    card.append(el("p", "status warn", "Not available on this browser"));
    if (signal.note) card.append(el("p", "note", signal.note));
    card.append(
      el("p", "bits-dropped", "Contributes 0 bits — excluded from the total.")
    );
    return card;
  }

  if (signal.note) card.append(el("p", "note", signal.note));

  const list = el("dl", "rows");
  const entries = Object.entries(signal.values).filter(([k]) => k !== "note");
  for (const [key, value] of entries) {
    list.append(valueNode(key, value));
  }
  card.append(list);

  if (entropy) {
    const modelled = meta.bits * FAMILIES[meta.family].redundancy;
    card.append(
      el("p", "bits-modelled", `Modelled contribution: ${modelled.toFixed(1)} bits after correlation discount`)
    );
  }

  return card;
}

export function renderSignals(container, results, entropyModel) {
  container.replaceChildren();

  for (const [familyKey, family] of Object.entries(FAMILIES)) {
    const signals = results.filter((r) => r.meta.family === familyKey);
    if (signals.length === 0) continue;

    const familyEntropy = entropyModel.families.find((f) => f.key === familyKey);

    const section = el("section", "family");
    section.append(
      el("h2", "family-title", family.label),
      el("p", "family-blurb", family.blurb)
    );

    if (familyEntropy) {
      section.append(
        el("p", "family-figure", [
          `${familyEntropy.count} signals · `,
          `${familyEntropy.nominal.toFixed(1)} bits nominal → `,
          `${familyEntropy.modelled.toFixed(1)} bits modelled `,
          `(${(familyEntropy.redundancy * 100).toFixed(0)}% correlation discount)`,
        ].join(""))
      );
    }

    const grid = el("div", "grid");
    for (const signal of signals) {
      grid.append(signalCard(signal, signal.meta, Boolean(familyEntropy)));
    }
    section.append(grid);
    container.append(section);
  }
}

export function renderSummary(container, entropyModel, resultCount) {
  container.replaceChildren();

  const bits = entropyModel.total;
  const tier = tierOf(bits);

  const card = el("section", `summary-tier-${tier.tone}`);

  const headline = el("div", "summary-headline");
  headline.append(
    el("p", "summary-eyebrow", "Modelled distinctiveness"),
    el("p", "summary-bits", `${bits.toFixed(1)}`),
    el("p", "summary-unit", "bits")
  );
  card.append(headline);

  const tierBox = el("div", "summary-tier");
  tierBox.append(
    el("p", "summary-tier-label", tier.label),
    el("p", "summary-tier-blurb", tier.blurb),
    el("p", "summary-population", shareFrame(bits))
  );
  card.append(tierBox);

  const available = resultCount.filter((r) => r.available).length;
  const unavailable = resultCount.length - available;

  const rows = [
    ["Signals answered", `${available} of ${resultCount.length}`],
    ["Signals unavailable", String(unavailable)],
    ["Raw sum if independent", `${entropyModel.nominalTotal.toFixed(1)} bits`],
    ["Discarded as correlated", `${entropyModel.discardedBits.toFixed(1)} bits`],
    ["Cross-family factor", `\u00d7${entropyModel.crossFamilyFactor.toFixed(2)}`],
    ["Implied population", formatPopulation(bits)],
  ];

  const detail = el("dl", "summary-detail");
  for (const [k, v] of rows) {
    const row = el("div", "summary-detail-row");
    row.append(el("dt", null, k), el("dd", null, v));
    detail.append(row);
  }
  card.append(detail);

  card.append(
    el("p", "summary-caveat", [
      "This is a model, not a measurement. Bit values are assumed from the ",
      "published literature and discounted for correlation. It tells you what ",
      "order of magnitude to expect, not what your exact odds are. Real ",
      "figures need a population to measure against, which is the whole point ",
      "of why a fingerprinting study collects thousands of samples and this ",
      "page cannot.",
    ].join(""))
  );

  container.append(card);
}

export function renderFooter(container, worldBits) {
  container.replaceChildren(
    el("p", null, [
      "For scale: world population is about 8.2 billion, which is ",
      `${worldBits.toFixed(1)} bits. `,
      "Any fingerprint above that line is unique on the planet.",
    ].join(""))
  );
}
