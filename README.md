# Fingerprint Lab

A browser-fingerprinting demonstration that runs entirely in the visitor's own
tab. It collects everything a fingerprinting site normally collects — canvas,
WebGL, audio, fonts, API surface, hardware hints — and then shows you exactly
what came back, where it came from, and how much of it narrows you down.

No server. No network requests. No storage. No consent needed, because there
is nothing to consent to.

---

## The premise

Browser fingerprinting is not exotic. It is the ordinary consequence of a
browser describing the machine it runs on in enough detail to lay out a page.

Every signal this page reads was volunteered by your browser to *any* page
that asked, without a prompt, because rendering requires it. The page
geometry, the GPU string, the font set, the list of supported APIs — these are
not secrets, they are the substrate of doing the job at all.

That is the thing worth understanding, and the reason this project exists:
the technique is identical to what a tracking company uses. The difference is
that this page answers instead of selling. A demonstration that hides what it
does is useless for that purpose, which is why the disclosure block is at the
top of the page rather than in a privacy policy nobody reads.

### What this project is not

- Not a telemetry backend. There is no `/api/collect`, no database, no
  visitor log, no analytics of any kind.
- Not a covert collection tool. Nothing is transmitted, so there is nothing
  to hide.
- Not a cookie-banner replacement. If a site collects data, a banner is the
  correct answer for that site; this page simply does not collect.

If your goal is to run a real fingerprinting study over a population, you
need informed consent, an ethics review, a documented methodology, and a
server you control. The probe code here is directly reusable for that — see
[Reusing the probes](#reusing-the-probes-for-a-real-study) — but that is a
different project with different obligations, not a config change to this one.

---

## Quick start

Because the code is split into ES modules, it needs a real origin. Opening
`index.html` from the filesystem will fail silently.

```bash
cd docs
python3 -m http.server 8000
# → http://localhost:8000
```

Any static server works. No build step, no dependencies, no bundler.

Then, before reading anything: open your browser's Network panel and reload.
The only requests are the document, the stylesheet, and the scripts. To make
the point unambiguously, disconnect from the network entirely and reload again
— the page still works, because there is nothing to fetch.

### Deploying to GitHub Pages

The site lives in `docs/` precisely so Pages can serve it with no CI.

1. Push this repository to GitHub.
2. **Settings → Pages → Source: Deploy from a branch.**
3. Branch `master`, folder **`/docs`**.
4. Save.

`.nojekyll` is present so Pages serves the files as-is. There is no build
step, so there is nothing to keep in sync.

---

## Architecture

```
docs/
├── index.html              Page shell, disclosure block, control panel
├── .nojekyll              Tells GitHub Pages to skip Jekyll processing
└── src/js/
    ├── app.js             Orchestration, progress, export
    ├── render.js          DOM rendering (no innerHTML — see below)
    ├── hash.js            SHA-256 / FNV-1a, stable serialisation
    ├── entropy.js         Entropy model and correlation discounting
    ├── deviceinfo.js      Device Info report (category one: browser detection)
    └── probes/
        ├── index.js       Registry — the only file to edit to add a signal
        ├── browser-detection.js  Category one: browser, engine, core, UA cross-check
        ├── identity.js    User-Agent, vendor, product strings
        ├── os-browser.js  OS & browser parsing from UA
        ├── client-hints.js  High-entropy Client Hints (Brave, Windows 11, arch)
        ├── locale.js      Language, time zone, calendar
        ├── display.js     Screen, viewport, DPR, media queries
        ├── hardware.js    Cores, RAM band, touch points
        ├── canvas.js      2D canvas render + pixel readback
        ├── webgl.js       Renderer strings, params, extensions, render hash
        ├── audio.js       OfflineAudioContext + DynamicsCompressor
        ├── fonts.js       Glyph-width font detection
        ├── features.js    Boolean vector over ~150 browser APIs
        ├── media.js       Codec support, MediaRecorder
        ├── media-devices.js  Speakers, microphones, cameras (counts)
        ├── device-capabilities.js  Web Bluetooth/NFC/Serial/USB presence
        ├── device-motion.js  Orientation + motion sensors
        ├── speech.js      SpeechSynthesis voice list
        ├── plugins-mime.js  Plugins, MIME types, Java/ActiveX
        ├── permissions.js Permission *states* — read, never requested
        ├── privacy-signals.js  DNT, GPC, private browsing, fingerprinting resistance
        ├── adblock-detect.js  Content blockers & extensions
        ├── storage.js     Quota, mechanisms, IndexedDB availability
        ├── network.js     NetworkInformation connection class
        ├── webrtc.js      ICE candidate structure — not addresses
        ├── math.js        IEEE 754 transcendental evaluation
        ├── performance-detail.js  Navigation Timing breakdown
        ├── page-interaction.js  Live mouse/keys/scroll/visibility
        └── timing.js      Clock precision and navigation timing
tests/
└── verify-browser.mjs      Browser detection is category one; smoke checks
```

### Probe contract

Every probe is an object with an `id`, `label`, `family`, `bits`, and an
async `run()`:

```js
export const probe = {
  id: "example",
  label: "What this measures",
  family: "rendering",
  bits: 2.0,
  async run() {
    return {
      available: true,   // false → excluded from the entropy total
      someValue: "…",
      note: "Optional caveat shown under the card.",
    };
  },
};
```

Return `{ available: false, note: "why" }` when a signal is blocked or
withheld. A blocked signal is a fact about the browser's policy, not about the
visitor, and must not contribute entropy.

To add a probe: write the file, import it in `probes/index.js`, add it to the
`PROBES` array. The renderer, entropy model and JSON export all pick it up
automatically.

### Two notes on the implementation

**Rendering is `textContent`, not `innerHTML`.** Probe output is arbitrary
strings from the platform — an API name, a GPU driver string, a font name.
Injecting them as HTML would be a self-inflicted XSS on a page whose whole
subject is untrusted input. Everything in `render.js` builds DOM nodes.

**The WebRTC probe reports shape, not payload.** ICE candidate lines contain
local IP addresses. This probe records the candidate *type* and whether the
address is an mDNS placeholder, and explicitly does not record the address.
No STUN server is contacted and `iceServers` is empty, so no `srflx`
candidate can be produced and no external endpoint learns about the visit.

---

## The entropy model

This is the part most likely to be misread, so it is spelled out here and
again in the UI.

The per-signal bit values are **assumed**, allocated from the range published
in the fingerprinting literature (EFF's Panopticlick and later work). They
are not measured, because this page sees exactly one browser. There is no
population to measure against.

Summing them naively overstates the answer badly, because the signals are
strongly correlated. A Windows machine with a discrete NVIDIA GPU and an
`en-GB` locale already predicts most of its own canvas hash, font list and
User-Agent string. So the model:

1. Groups signals into four **families** — platform, rendering, software
   surface, network/timing.
2. Discounts each family for internal correlation (×0.60 to ×0.80).
3. Discounts the combination of families for cross-family correlation
   (×0.85).

For headless Chrome this yields 39.3 bits against a naive sum of 68.2, with
28.9 bits discarded as correlation. That lands in the 25–40 bit band that
published full-vector measurements report, which is the honest target.

**Treat the number as an order-of-magnitude estimate.** It answers "roughly
how identifiable am I?", not "what are my exact odds?". A real figure requires
thousands of samples across a real population — which is exactly what this
page cannot do, and the reason the caveat is printed next to the number rather
than footnoted.

One useful anchor: world population is about 8.2 billion, or 32.9 bits. Any
fingerprint above that line is unique on the planet.

---

## What this page does not do

Stated explicitly because the absence is the design, not an oversight:

| Not collected | Why not |
|---|---|
| IP address | No server is contacted. There is nothing to receive it. |
| Location | `navigator.geolocation` is never called. |
| Camera, microphone | `getUserMedia` is never called. |
| Clipboard | Never read. |
| Cookies, `localStorage`, IndexedDB | Nothing is written. The storage probe writes and immediately deletes its own throwaway key. |
| Behaviour | No keystroke, pointer, scroll or dwell tracking. |
| Cross-site identity | Third-party requests would create one. There are none. |
| Fonts over the network | No web fonts. The stylesheet uses the system stack. |

The permission probe reads *states* only. `navigator.permissions.query()`
tells a page whether you have previously granted or denied something, without
prompting — which is itself a real and under-appreciated leak, and the reason
that probe exists. It demonstrates the asymmetry rather than exploiting it.
`notifications` and `push` are excluded from the query list precisely because
some engines prompt on query.

---

## Reducing your own number

Not the point of the page, but the natural second question.

- **A browser that resists fingerprinting** — Brave, Tor Browser, or Firefox
  with `privacy.resistFingerprinting`. This is the only change that moves the
  number a lot.
- **A common window size.** Odd dimensions are a durable signal.
- **A default time zone.** Travel with a laptop and the offset follows you.
- **A default font set.** Installing a few fonts costs several bits.
- **Fewer extensions.** Each one adds API surface.

Notice the pattern: every mitigation costs you something. That trade-off —
between identifiability and convenience — is the actual research question this
page is built to make visible. A fingerprint that reveals nothing about you
also reveals nothing useful to the sites you deliberately use.

---

## Reusing the probes for a real study

If you are running a legitimate study, the probe modules are the valuable
part and are designed to be lifted out:

- Each `probe.run()` returns a plain JSON-serialisable object. No DOM
  dependencies beyond a canvas.
- Removing the `render.js` / `app.js` layer and posting `buildRecord()` output
  to your own endpoint gives you a working collection pipeline.
- You then need: informed consent, an ethics review, a retention and
  deletion policy, a documented methodology, and a data-protection statement.
  The storage code must strip low-cardinality cohorts before any aggregate is
  published — per-visitor counts are re-identifying in small groups, and
  "there is only one person here on that ASN" is a finding you must not
  publish.

The probes do not do any of that. They measure. The obligations are yours.

---

## Browser support

The page degrades on every line rather than failing hard. Probes that cannot
run report `available: false` with a reason and are excluded from the total.

- **Chrome / Edge / Opera** — nearly everything. WebGL renderer strings are
  exposed without restriction.
- **Firefox** — everything except high-entropy Client Hints. Speech voices
  may be empty until speech is used.
- **Safari** — most signals. AudioContext is present; several
  `navigator.connection` fields are absent.
- **Tor Browser / Firefox resistFingerprinting / Brave** — canvas and audio
  hashes collapse to constants, which the page reports as a blocked signal
  rather than counting as entropy.

---

## Licence

MIT. See [LICENSE](LICENSE).
