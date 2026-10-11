/**
 * Speech synthesis voices.
 *
 * A surprisingly effective desktop signal: operating systems and installed
 * language packs ship different voice sets, the list is stable per machine,
 * and it is readable the moment the page loads -- no gesture, no prompt.
 * Chrome populates it asynchronously on first access, hence the wait below.
 */

export const probe = {
  id: "speech",
  label: "Speech synthesis voices",
  family: "software",
  bits: 2.2,
  async run() {
    if (!window.speechSynthesis || typeof speechSynthesis.getVoices !== "function") {
      return { available: false, note: "SpeechSynthesis unavailable." };
    }

    const read = () =>
      speechSynthesis.getVoices().map((v) => ({
        name: v.name,
        lang: v.lang,
        localService: v.localService,
        default: v.default,
      }));

    let voices = read();
    if (voices.length === 0) {
      // Wait for the voiceschanged event, but never hang the page.
      await new Promise((resolve) => {
        let settled = false;
        const done = () => {
          if (!settled) {
            settled = true;
            speechSynthesis.removeEventListener("voiceschanged", done);
            resolve();
          }
        };
        speechSynthesis.addEventListener("voiceschanged", done, { once: true });
        setTimeout(done, 1500);
      });
      voices = read();
    }

    if (voices.length === 0) {
      return {
        available: false,
        note:
          "Voice list is empty. Some engines withhold it until speech is "
          + "first used.",
      };
    }

    return {
      available: true,
      count: voices.length,
      languages: Array.from(new Set(voices.map((v) => v.lang))).sort(),
      names: voices.map((v) => v.name).sort(),
      localServices: voices.filter((v) => v.localService).length,
      voices,
    };
  },
};
