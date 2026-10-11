/**
 * Storage capacity and profile availability.
 *
 * `navigator.storage.estimate()` returns a quota that, in most engines, is a
 * fixed fraction of the device's free disk. On Chrome it is within a couple of
 * percent of the real free space -- which makes it a disk-size proxy, and a
 * surprisingly stable one across visits because the value is bucketed.
 *
 * Whether each storage mechanism *exists* (IndexedDB, Cookie Store, OPFS) is
 * a build signal independent of capacity.
 */

export const probe = {
  id: "storage",
  label: "Storage & persistence",
  family: "platform",
  bits: 1.1,
  async run() {
    const mechanisms = {
      localStorage: (() => {
        try {
          const k = "__fl_probe__";
          window.localStorage.setItem(k, "1");
          window.localStorage.removeItem(k);
          return true;
        } catch {
          return false;
        }
      })(),
      sessionStorage: (() => {
        try {
          const k = "__fl_probe__";
          window.sessionStorage.setItem(k, "1");
          window.sessionStorage.removeItem(k);
          return true;
        } catch {
          return false;
        }
      })(),
      indexedDB: "indexedDB" in window,
      cookieStore: "cookieStore" in window,
      caches: "caches" in window,
      opfs: "showOpenFilePicker" in window || "FileSystemFileHandle" in window,
      storageBuckets: "storageBuckets" in navigator,
    };

    let estimate = null;
    if (navigator.storage && typeof navigator.storage.estimate === "function") {
      try {
        const est = await navigator.storage.estimate();
        estimate = {
          quotaBytes: est.quota ?? null,
          usageBytes: est.usage ?? null,
          quotaGB: est.quota ? Number((est.quota / 1024 ** 3).toFixed(3)) : null,
          usageGB: est.usage ? Number((est.usage / 1024 ** 3).toFixed(6)) : null,
          quotaAsFractionOfUsage: est.usage ? Number((est.quota / est.usage).toFixed(2)) : null,
        };
      } catch {
        estimate = null;
      }
    }

    let persisted = null;
    if (navigator.storage && typeof navigator.storage.persisted === "function") {
      try {
        persisted = await navigator.storage.persisted();
      } catch {
        persisted = null;
      }
    }

    return {
      available: true,
      mechanisms,
      estimate,
      persisted,
      cookieLength: (document.cookie || "").length,
      note:
        "The quota is a fraction of free disk in most engines, so it acts as "
        + "a disk-capacity proxy. This page writes nothing to any of these -- "
        + "the probe writes and immediately deletes its own throwaway key.",
    };
  },
};
