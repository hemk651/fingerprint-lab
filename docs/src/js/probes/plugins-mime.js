/**
 * Plugins, MIME types, and legacy tech.
 *
 * `navigator.plugins` and `navigator.mimeTypes` are deprecated and most modern
 * browsers now report an empty array. Where they are populated the list is
 * identifying; where it is empty, that emptiness is itself the signal — it
 * distinguishes a hardened browser from a legacy one.
 *
 * Java detection via `navigator.javaEnabled()` returns false everywhere now,
 * which is a finding rather than a failure.
 */
export const probe = {
  id: "plugins-mime",
  label: "Plugins, MIME types & legacy tech",
  family: "software",
  bits: 2.5,
  async run() {
    const plugins = [];
    if (navigator.plugins && navigator.plugins.length) {
      for (const p of navigator.plugins) {
        plugins.push({
          name: p.name || null,
          filename: p.filename || null,
          description: p.description || null,
          version: p.version || null,
        });
      }
    }

    const mimeTypes = [];
    if (navigator.mimeTypes && navigator.mimeTypes.length) {
      for (const m of navigator.mimeTypes) {
        mimeTypes.push({
          type: m.type || null,
          description: m.description || null,
          suffixes: m.suffixes || null,
          enabledPlugin: m.enabledPlugin ? m.enabledPlugin.name : null,
        });
      }
    }

    let java = null;
    try {
      java = typeof navigator.javaEnabled === "function" ? navigator.javaEnabled() : null;
    } catch {
      java = null;
    }

    // ActiveX is IE-only. Every other browser returns false, which is correct
    // and worth reporting because it confirms the browser is not IE.
    const activeX = typeof window.ActiveXObject === "function";

    return {
      available: true,
      pluginCount: plugins.length,
      plugins,
      mimeTypeCount: mimeTypes.length,
      mimeTypes,
      javaEnabled: java,
      activeXSupported: activeX,
      note:
        plugins.length === 0
          ? "Empty plugin list. Expected on hardened browsers; a populated list is identifying."
          : `${plugins.length} plugins reported — a populated list narrows the browser considerably.`,
    };
  },
};
