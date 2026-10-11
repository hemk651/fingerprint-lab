/**
 * Live page interaction state.
 *
 * Everything here is captured by listeners registered for the lifetime of the
 * page. It is the only probe that changes while you watch it, and the only one
 * that demonstrates a category of tracking this project otherwise only
 * describes: behavioural signals.
 *
 * It is deliberately capped. A page that recorded every keystroke indefinitely
 * would be building a profile; one that shows you the last key pressed is
 * demonstrating the capability. Same for the mouse.
 */

const MAX_SAMPLES = 12;

export function createPageInteractionProbe() {
  const state = {
    keysPressed: [],
    lastKey: null,
    mousePosition: { x: null, y: null, inView: null },
    scroll: { x: 0, y: 0 },
    capsLock: null,
    visibilityChanges: [],
    lastVisible: null,
    lastHidden: null,
    popupsBlocked: 0,
  };

  let attached = false;

  function attach() {
    if (attached) return;
    attached = true;

    window.addEventListener("keydown", (e) => {
      state.lastKey = e.key === " " ? "Space" : e.key;
      state.keysPressed.push(e.key);
      if (state.keysPressed.length > MAX_SAMPLES) state.keysPressed.shift();
      try {
        if (e.getModifierState) state.capsLock = e.getModifierState("CapsLock");
      } catch {
        /* not all engines support this */
      }
    });

    window.addEventListener("mousemove", (e) => {
      state.mousePosition = {
        x: Math.round(e.clientX),
        y: Math.round(e.clientY),
        inView: e.clientY >= 0 && e.clientY < window.innerHeight,
      };
    });

    window.addEventListener("scroll", () => {
      state.scroll = { x: Math.round(window.scrollX), y: Math.round(window.scrollY) };
    });

    document.addEventListener("visibilitychange", () => {
      const now = new Date().toISOString();
      if (document.visibilityState === "visible") state.lastVisible = now;
      else state.lastHidden = now;
      state.visibilityChanges.push({ state: document.visibilityState, at: now });
      if (state.visibilityChanges.length > 10) state.visibilityChanges.shift();
    });

    // Popup behaviour: window.open is only allowed during a user gesture in
    // most engines. The test records whether it succeeded.
    try {
      const w = window.open("", "_blank");
      if (w) {
        w.close();
        state.popupsBlocked = false;
      } else {
        state.popupsBlocked = true;
      }
    } catch {
      state.popupsBlocked = true;
    }
  }

  return {
    id: "page-interaction",
    label: "Live interaction state",
    family: "behaviour",
    bits: 0.5,
    async run() {
      attach();
      await new Promise((resolve) => setTimeout(resolve, 800));
      return {
        available: true,
        ...state,
        note:
          "Updated live. Only the last " + MAX_SAMPLES + " keys are retained " +
          "and nothing is transmitted — a page that kept everything would be " +
          "building a profile, which is the point being demonstrated.",
      };
    },
  };
}
