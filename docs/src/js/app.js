/**
 * Application entry point.
 *
 * Orchestrates the probes, renders results as they land, and produces the
 * exportable record. There is deliberately no fetch() anywhere in this file
 * or in anything it imports -- see README.md, "Network isolation".
 */

import { PROBES } from "./probes/index.js";
import { modelEntropy, WORLD_POPULATION_BITS } from "./entropy.js";
import {
  renderSignals,
  renderSummary,
  renderFooter,
} from "./render.js";
import { renderDeviceInfo } from "./deviceinfo.js";

const dom = {
  progress: document.getElementById("progress"),
  progressBar: document.getElementById("progress-bar"),
  progressLabel: document.getElementById("progress-label"),
  summary: document.getElementById("summary"),
  signals: document.getElementById("signals"),
  deviceinfo: document.getElementById("deviceinfo-report"),
  scale: document.getElementById("scale"),
  rerun: document.getElementById("rerun"),
  copy: document.getElementById("copy"),
  download: document.getElementById("download"),
  status: document.getElementById("status"),
};

let lastRecord = null;
let running = false;

function setStatus(message) {
  if (dom.status) dom.status.textContent = message;
}

function updateProgress(done, total) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  if (dom.progressBar) dom.progressBar.style.width = `${pct}%`;
  if (dom.progressLabel) {
    dom.progressLabel.textContent = `${done} / ${total} signals`;
  }
  if (dom.progress) {
    dom.progress.setAttribute("aria-valuenow", String(done));
    dom.progress.setAttribute("aria-valuemax", String(total));
  }
}

/**
 * Run one probe. Never throws: a probe that fails returns an
 * `available: false` record, which the entropy model excludes.
 */
async function runProbe(meta) {
  const started = performance.now();
  try {
    const values = await meta.run();
    const available = values.available !== false;
    return {
      id: meta.id,
      meta,
      available,
      values,
      note: values.note || null,
      durationMs: Number((performance.now() - started).toFixed(2)),
    };
  } catch (err) {
    return {
      id: meta.id,
      meta,
      available: false,
      values: {},
      note: `Probe threw: ${err && err.message ? err.message : String(err)}`,
      durationMs: Number((performance.now() - started).toFixed(2)),
    };
  }
}

function buildRecord(results, entropy) {
  return {
    generator: "Fingerprint Lab",
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    disclosure:
      "Computed entirely in this browser tab. Nothing was transmitted, " +
      "stored server-side, or written to any storage mechanism.",
    entropy: {
      modelledBits: Number(entropy.total.toFixed(2)),
      nominalSumBits: Number(entropy.nominalTotal.toFixed(2)),
      discardedAsCorrelatedBits: Number(entropy.discardedBits.toFixed(2)),
      crossFamilyFactor: entropy.crossFamilyFactor,
      families: entropy.families.map((f) => ({
        family: f.key,
        label: f.label,
        signals: f.count,
        nominalBits: Number(f.nominal.toFixed(2)),
        modelledBits: Number(f.modelled.toFixed(2)),
        redundancy: f.redundancy,
      })),
    },
    signals: results.map((r) => ({
      id: r.id,
      label: r.meta.label,
      family: r.meta.family,
      nominalBits: r.meta.bits,
      available: r.available,
      note: r.note,
      durationMs: r.durationMs,
      values: r.values,
    })),
  };
}

async function run() {
  if (running) return;
  running = true;

  dom.rerun.disabled = true;
  dom.copy.disabled = true;
  dom.download.disabled = true;
  setStatus("Collecting…");
  dom.signals.replaceChildren(
    Object.assign(document.createElement("p"), {
      className: "placeholder",
      textContent: "Running probes. This page makes no network requests; every value comes from this tab.",
    })
  );
  dom.summary.replaceChildren();
  if (dom.deviceinfo) dom.deviceinfo.replaceChildren();
  updateProgress(0, PROBES.length);

  const results = [];
  // Kick off every probe at once; the UI updates as each resolves. The
  // audio and WebRTC probes take the longest and run in the background.
  const pending = PROBES.map((meta) => runProbe(meta));

  for (const promise of pending) {
    // eslint-disable-next-line no-await-in-loop
    const result = await promise;
    results.push(result);
    updateProgress(results.length, PROBES.length);
    setStatus(
      `${results.length} of ${PROBES.length} signals collected — ${
        results.filter((r) => r.available).length
      } available`
    );
  }

  // Present in a stable order regardless of resolution timing.
  const ordered = PROBES.map(
    (meta) => results.find((r) => r.id === meta.id) || {
      id: meta.id,
      meta,
      available: false,
      values: {},
      note: "Probe did not return.",
      durationMs: 0,
    }
  );

  // Flatten to the shape the entropy model expects. Done here rather than
  // inside entropy.js so the model stays independent of the probe-result
  // envelope.
  const entropy = modelEntropy(
    ordered.map((r) => ({
      id: r.id,
      family: r.meta.family,
      bits: r.meta.bits,
      available: r.available,
    }))
  );

  renderSummary(dom.summary, entropy, ordered);
  renderSignals(dom.signals, ordered, entropy);
  if (dom.deviceinfo) renderDeviceInfo(dom.deviceinfo, ordered);
  renderFooter(dom.scale, WORLD_POPULATION_BITS);

  lastRecord = buildRecord(ordered, entropy);

  const unavailable = ordered.filter((r) => !r.available);
  setStatus(
    `Done. ${ordered.length - unavailable.length} signals collected, ` +
      `${unavailable.length} unavailable (no permission was requested for any of them).`
  );

  dom.rerun.disabled = false;
  dom.copy.disabled = false;
  dom.download.disabled = false;
  running = false;
}

function wireControls() {
  dom.rerun?.addEventListener("click", () => {
    void run();
  });

  dom.copy?.addEventListener("click", async () => {
    if (!lastRecord) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(lastRecord, null, 2));
      setStatus("Report copied to the clipboard. It exists only where you paste it.");
    } catch {
      setStatus("Clipboard access refused — use Download instead.");
    }
  });

  dom.download?.addEventListener("click", () => {
    if (!lastRecord) return;
    const blob = new Blob([JSON.stringify(lastRecord, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fingerprint-report-${
      new Date().toISOString().replace(/[:.]/g, "-")
    }.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Saved to your downloads folder. Nowhere else.");
  });
}

wireControls();

// Start on load. This is the point being demonstrated: everything below is
// available to any page the moment it opens, with no interaction at all.
void run();
