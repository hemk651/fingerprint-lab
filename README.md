# Fingerprint Lab

A browser-fingerprinting demonstration in a single self-contained HTML file.

Open `index.html` in any browser. Double-clicking it works — no server, no
install, no build step, no dependencies of any kind.

It runs the same primitives a tracking site runs — canvas, WebGL, audio, font
detection, API surface, hardware hints, User-Agent analysis — and shows you
what came back and how much of it narrows you down.

## What it does

27 probes across 7 families, plus a 17-section Device Info report covering
browser identity, User-Agent token decomposition, Client Hints, API
capabilities, hardware, network class, storage, and page performance.

Every value in the report is tagged by how it was obtained:

| Tag | Meaning |
|---|---|
| `client-side` | Detected in the browser. No permission, no network. |
| `withheld` | The browser withholds or normalises this signal. |
| `permission required` | Needs the user to grant access first. |
| `requires server` | Cannot be known from the browser at all. |

The last tag is the honest half of the report. A site that shows you an IP
address, a city or a TLS cipher is telling you what its **server** learned, not
what your browser volunteered. Both halves sit side by side because the
difference between them is the actual privacy boundary.

## Why one file

The page is a static site: hand-written HTML, CSS and JavaScript with no
framework and no packages. Everything — 33 modules, the stylesheet, and the
small module runtime that ties the modules together — is inlined into
`index.html`.

A fingerprinting tool has an obvious supply-chain problem: every package it
installs is third-party code with network access to the page that measures
you. Removing the dependency tree removes the question entirely.

## What it does not do

Stated plainly because the absence is the design:

- **No network requests.** Nothing is fetched, sent, or stored. Open the
  Network panel and reload: the only request is the file itself.
- **No server contact**, so no IP address, no geolocation, no ISP lookup.
- **No permission prompts.** Geolocation, camera, microphone and clipboard are
  never requested. Permission *states* are read, which is a separate and more
  interesting thing.
- **No cookies or storage writes.**
- **No third-party resources.** No web fonts, no CDN, no external scripts.

## Privacy settings this respects

The page reports what your browser is withholding, rather than assuming:

- A browser that normalises its canvas or audio pipeline shows those probes as
  `withheld`.
- Firefox's `privacy.resistFingerprinting`, Brave and Tor Browser each show up
  as detected resistance.
- Client Hints are read when offered and reported as unavailable when not,
  which is the norm on Firefox and Safari.

## Modelled distinctiveness

The report shows a bit estimate with a per-family breakdown. Read it as an
order of magnitude, not a measurement: the per-signal bit values are assumed
from published fingerprinting research and discounted for correlation between
signals, because naively summing them badly overstates the answer. World
population is about 32.9 bits, so anything above that line is unique on the
planet.

## Licence

MIT — see [LICENSE](LICENSE).