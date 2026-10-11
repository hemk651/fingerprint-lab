# Passive Browser Fingerprintability — Research & Build Plan

**Project:** telemetry-data-collection
**Type:** Cybersecurity research (consent-first passive measurement)
**Deployment:** Flask backend behind a TLS-terminating proxy; static frontend
**Status:** skeleton committed (`mainApiFolder/index.py`, `requirements.txt`, `.gitignore`). Server is non-functional — see §2.

---

## 0. Scope and boundary

This project measures **how much identifying information a web client passively exposes to a server during a normal page visit**, and quantifies it with published statistical metrics.

The system is **consent-gated**. No signal is read and no request is made to the collection endpoint until the visitor explicitly agrees. The scan itself is identical either way — the difference is that the person chose to be measured, which is what makes the result publishable rather than merely interesting.

**Out of scope, permanently:** covert collection, collection without opt-in, and any use of this tool to track people who did not come here to be tracked. The consent gate is a design invariant, not a config toggle — see §9.1.

Rationale: the research question ("what does a browser leak?") is fully answerable with consent, and it is *only* answerable in a publishable way with consent. Covert collection would also put the operator in clear breach of GDPR Art. 6/7, the ePrivacy Directive Art. 5(3), CCPA/CPRA, and India's DPDP Act 2023 — which for a hosted research project is a liability that ends the project.

---

## 1. Research question and hypotheses

### 1.1 Primary question

> **RQ1.** For a given population of web clients, how much entropy does passive observation of a single visit yield, and what is the resulting anonymity set (crowd size) of an individual visitor?

### 1.2 Secondary questions

| ID | Question |
|----|----------|
| RQ2 | Which individual vectors contribute the most discriminating entropy, and how does that ranking shift by browser engine and OS? |
| RQ3 | What is the **minimal set** of passive vectors that maximises population uniqueness? (greedy minimax / maximin search) |
| RQ4 | How does total fingerprintability differ under default browser settings vs. hardened modes (Firefox `resistFingerprinting`, Brave Shields, Tor Browser)? |
| RQ5 | Which vectors are **stable** across repeat visits (T+1d, T+7d, T+30d), and therefore useful for cross-session linkage? |
| RQ6 | How much entropy is contributed by the **transport layer** (TLS ClientHello fingerprint, header order) vs. the **JavaScript layer**? |

### 1.3 Hypotheses

- **H1.** A minimal combination of ≤6 passive vectors uniquely identifies >90% of a sample population ≥1,000.
- **H2.** Anti-fingerprinting modes (RFP / Shields) reduce total entropy by a factor of ≥3× relative to defaults, with the loss concentrated in canvas, audio, and font surfaces.
- **H3.** Transport-layer (TLS) entropy is lower than JavaScript-layer entropy on its own, but is **highly complementary** — union adds non-trivial bits beyond the JS set.
- **H4.** Cross-session stability is high (>0.8) for hardware/GPU-derived vectors and low (<0.5) for volatile signals (battery, network conditions, transient timing).

> These are hypotheses to be *tested*, not claims. Prior literature (see §14) reports figures under varying population definitions; the plan is to produce measurements under **this** deployment's conditions, and to state clearly where they diverge from prior art.

---

## 2. Current state audit

### 2.1 What exists

| Path | Status |
|------|--------|
| `mainApiFolder/index.py` | 463 lines. Flask app, routes, consent token issuance/verification, request sanitisation, Client Hints extraction, TLS/network enrichment. |
| `requirements.txt` | `Flask>=3.0.0` |
| `.gitignore` | Sensible — excludes `data/`, `observations*.json`, `datasets/`, `exports/`, `secrets.txt`, `.env`, `*.mmdb`. Good. |

### 2.2 What is missing (blocking)

The module will not import. `index.py:28` imports four modules that do not exist:

- `mainApiFolder/analysis.py` — `parse_user_agent()`, `client_hints_summary()`
- `mainApiFolder/geo.py` — `normalise_ip()`, `ip_scope()`, `lookup()`
- `mainApiFolder/storage.py` — `record_observation()`, `load_observations()`, `cohort_report()`
- `mainApiFolder/taxonomy.py` — `SECTIONS`, `coverage_summary()`
- `mainApiFolder/categories.py` — imported, no visible call sites yet

Also missing: `templates/index.html`, `static/` (frontend scan bundle), `.env.example`, `run.sh`, tests.

### 2.3 Required change to existing code

`index.py` is structured well — the consent verification (`verify_consent`), stateless HMAC consent tokens, server-side IP handling, and body sanitisation are all sound and should be preserved.

**Change required:** invert the collection defaults. See §9.1. Specifically:

- `AUTO_COLLECT` default → `false`
- `REQUIRE_CONSENT` default → `true`
- `COHORT_ENDPOINT` default → `false`
- Remove the "no button, no dialog, no permission request" framing from the module docstring and `/` route docstring.

---

## 3. Threat model and adversary

The measurement is only meaningful with an explicit adversary. Three tiers, reported separately:

| Tier | Capability | Is in scope for measurement |
|------|-----------|-------------------------------|
| **A1 — Network observer** | Sees IP, TLS ClientHello, headers. No JS. | Yes |
| **A2 — Server operator (the site)** | Sees everything the browser sends, including JS-collected vectors. | Yes — this is the system being built |
| **A3 — Cross-site tracker** | Joins observed fingerprint against a known population. Has the vector but not the plaintext identity. | Yes — the re-identification experiment |

### 3.1 Re-identification experiment (core of RQ1)

Formalise A3 as a linkability game:

1. Attacker observes a target's vector set `V` from one visit.
2. Attacker has a database of `N` enrolled records with vectors `{v_1..v_N}` and associated pseudonymous identities.
3. Attacker predicts which `v_i` corresponds to `V`.
4. **Success** = predicted `v_i` is the true match.

Report: success probability vs. population size, vs. vector subset size, vs. k-anonymity threshold. This turns "how much data do you have" into "what can you actually do with it," which is the part that matters for the writeup.

### 3.2 Out of model

Active probing (TLS client-cert enumeration, timing side-channels beyond passive observation), cross-origin tracking of third-party sites, and any use of the collected data against identified individuals.

---

## 4. Signal taxonomy

Grouped by access surface. `taxonomy.py` should encode this as structured data so `/api/v1/schema` and the UI both read from one source of truth.

### 4.1 Network layer — server-observed, A1/A2 only

| Vector | Source | Expected entropy | Notes |
|--------|--------|------------------|-------|
| IPv6 prefix (/64) | `request.remote_addr` | very high | ~64 bits of stable subnet identity. Dominant vector. |
| ASN / ISP | GeoIP DB | ~10–13 bits | |
| Approximate geolocation | GeoIP DB | ~12 bits | Optional; `GEOLOCK=true` disables lookup |
| TLS version + cipher + ALPN | WSGI environ | ~4–8 bits | Requires TLS-terminating proxy — see §7.2 |
| **JA3 / JA3S** | TLS ClientHello hash | ~4–8 bits | Not derivable from JS at all. Requires proxy logging. |
| **JA4** | Newer ClientHello hash | ~4–8 bits | Better resistance to GREASE/extension reordering than JA3 |
| HTTP/2 SETTINGS order | H2 frame | ~2–3 bits | Requires HTTP/2 termination |
| `Accept-Language` | header | ~1–3 bits | |
| `Accept-Encoding` order | header | ~1 bit | |

### 4.2 Client Hints — server-observed, high value

| Vector | Expected entropy | Notes |
|--------|------------------|-------|
| `Sec-CH-UA-Platform-Version` | ~6–8 bits | **Precise OS build number**, e.g. `"15.0.0"` |
| `Sec-CH-UA-Full-Version-List` | ~5–8 bits | Exact browser build |
| `Sec-CH-UA-Model` | ~4–6 bits | **Android hardware model** — closest a page gets to a device SKU |
| `Sec-CH-UA-Arch` / `-Bitness` | ~2 bits | |
| `Sec-CH-UA-Mobile` | 1 bit | |
| `Sec-CH-UA-WoW64` | 1 bit | WoW64 emulation layer |

> Gated behind `Accept-CH` request header. Already implemented in `index.py` (`HINTS_HEADER_VALUE`). Firefox and Safari send a subset — absence is signal about the engine, and should be recorded as such rather than treated as null.

### 4.3 JavaScript layer — client-collected

| Group | Vectors | Expected entropy |
|-------|---------|------------------|
| `screen` | width, height, availWidth/Height, colorDepth, pixelDepth, `devicePixelRatio` | 6–14 bits. `devicePixelRatio` was a historic Windows supercookie (Brave 2020). |
| `hardware` | `hardwareConcurrency`, `deviceMemory`, `maxTouchPoints` | 4–6 bits. Strong **device-class** signal (laptop vs phone). |
| `graphics` | WebGL `VENDOR`/`RENDERER`, `UNMASKED_*`, `MAX_TEXTURE_SIZE`, `MAX_VIEWPORT_DIMS`, aliased line-width range, float precision, WebGL2 extension list | 8–12 bits. Distinguishes laptop models. |
| `canvas` | 2D canvas text + geometry hash | 5–15 bits, highly variable by renderer/driver |
| `audio` | `OfflineAudioContext` render hash | 4–8 bits, driver-dependent |
| `fonts` | `offsetWidth` probing against a detection list | 0–15 bits, **strongly browser-dependent** (see §4.4) |
| `locale` | `navigator.languages`, `Intl` resolved timezone | 2–4 bits |
| `network` | `navigator.connection` effectiveType/downlink/rtt/saveData | 2–3 bits, volatile |
| `media` | `enumerateDevices()` **counts only** (labels need permission) | 2–4 bits |
| `permissions` | `navigator.permissions.query()` states | 2–3 bits |
| `features` | CSS media queries: `prefers-color-scheme`, `pointer`, `any-hover`, `display-mode`, `forced-colors` | 2–3 bits |
| `battery` | `getBattery()` level/charging | 1 bit, **volatile + being removed from browsers** |
| `storage` | `navigator.storage.estimate()` quota bucket | 1–2 bits |
| `speech` | `getVoices()` count/identity | 2–4 bits |
| `math` | floating-point arithmetic consistency probes | 1–2 bits, engine-build signal |
| `timing` | `performance.now()` resolution, Date clamping | 1–2 bits, mostly defeated in modern browsers |
| `errors` | Deliberate error-stack/engine quirk probes | 2–3 bits |

### 4.4 Vectors that are shrinking — report availability, not just value

Font enumeration has been progressively restricted (Firefox `privacy.reduceFontFingerprinting`, Safari cross-origin font blocking). Battery API is being deprecated. Plugin enumeration collapsed after 2015.

**Design requirement:** every vector records `available: bool` in addition to its value. A missing vector is itself an engine/config signal and must be represented, not skipped — otherwise per-vector entropy is biased by availability correlation. `taxonomy.coverage_summary()` should already support this.

### 4.5 Device classification (the "device info" results view)

Derived, not collected — infer class from hardware/graphics/screen/hints:

- **Phone / tablet** — `maxTouchPoints > 0`, coarse pointer, mobile UA-CH, high DPR, absent physical screen sizes
- **Laptop / desktop** — fine pointer, `deviceMemory` + `hardwareConcurrency` buckets, physical GPU string
- **Headless / automation** — missing WebGL, zero `hardwareConcurrency`, absent Client Hints, empty device list

This is a presentation layer over the vector set, and it should be reported with an explicit **confidence interval**, because misclassification is the most likely source of reviewer challenge.

---

## 5. Measurement methodology

### 5.1 Per-vector entropy

Shannon entropy of the observed value distribution:

```
H(X) = -Σ p(x) log2 p(x)
```

Apply the **Miller–Madow** small-sample correction, since the estimator is positively biased at low N:

```
H_MM = H_plugin + (K - 1) / (2 · N · ln 2)
```

where `K` = observed distinct categories, `N` = sample size. Report both, and report K and N alongside every entropy figure — an entropy claim without K and N is not a result.

### 5.2 The independence trap (must be stated in the writeup)

Summing per-vector entropy, `H(total) ≈ Σ H_i`, is an **upper bound that is almost certainly wrong**. The vectors are strongly correlated:

- `screen.width` ↔ `deviceMemory` ↔ `hardwareConcurrency` all encode device class
- `Sec-CH-UA-Platform-Version` is largely determined by the UA string
- WebGL `RENDERER` correlates with `Bitness` and `Arch`

Handle this in three ways, and report all three:
1. **Naive sum** — label it explicitly as an upper bound.
2. **Pairwise mutual information matrix** — identify and report the redundant groups.
3. **Greedy maximin attribute search** (Panopticlick's method) — iteratively add the vector that most increases the number of unique combinations, until the maximin set is identified. This gives the honest answer to RQ3.

### 5.3 Anonymity set / crowd size

Per **Larmount & Shokri (2014)**, the anonymity set of a user with entropy `H` bits under identification probability threshold `p`:

```
CS = (H - 1) / (p · log2 p)
```

Report `CS` at p = 0.1 / 0.5 / 0.9. Also compute the **k-anonymity threshold** — the number of attributes at which the anonymity set drops below a stated k (e.g. k = 1000). That crossing point is the headline number.

### 5.4 Stability (RQ5)

Re-collect the same consented participants at fixed intervals. For each vector, compute:

- **Self-match rate** — fraction of T+X visits matching the T baseline exactly
- **Mean normalized Hamming distance** across the vector set

Plot retention curves per vector. Expect the hypothesis H4 pattern; verify rather than assume.

### 5.5 Baselines and comparison set

Run the same measurement harness against, or in the same conditions as:

| Baseline | Why |
|----------|-----|
| FingerprintJS (open-source v3) | Reference implementation; v4 is proprietary — do not compare against it |
| CreepJS | Broadest public vector coverage |
| Cover Your Tracks (EFF) | Defensive framing; measures tracker resistance |
| Panopticlick | Academic reference for the maximin method |
| Firefox `resistFingerprinting` on/off | Direct test of H2 |
| Brave Shields (Standard/Strict) | Direct test of H2 |
| Tor Browser | Lower bound — expect near-total flattening |

### 5.6 Sample size and honest power

Entropy estimation needs the whole population distribution, so N must exceed the number of distinct categories by a wide margin.

| N | What it supports |
|---|---|
| 50 | Engineering validation only. No entropy claims. |
| 300 | Per-vector entropy to roughly ±0.3 bits for coarse vectors; maximin search indicative |
| 1,000 | Defensible per-vector entropy; stable RQ3 maximin set |
| 5,000+ | Population-level claims, small-cell suppression becomes meaningful |

**Target N ≥ 1,000 for publishable claims.** State this limitation prominently. Recruitment is the single largest risk to the project — see §12.

### 5.7 Time and confounding

Record `ingested_at` on every observation. Browser auto-updates change vector distributions mid-study. Any entropy figure must be reported with its collection window, and the study should not straddle a major browser release without a note.

---

## 6. Experimental design

### 6.1 Protocol

1. Visitor lands on `/`. **No collection has occurred.**
2. Disclosure page lists every vector group in plain language, states retention period, names the operator and contact.
3. Visitor clicks **Agree** (or **Decline** — equally prominent, one click, no dark patterns).
4. On agree: mint consent token, `localStorage` flag, load scan bundle, run scan, POST to `/api/v1/observe`.
5. Results page renders the collected vectors, per-vector entropy, and the device-class inference.
6. Consent TTL 2h. **Withdrawal** must be as easy as granting — a visible "Delete my data" control that triggers server-side purge.

### 6.2 Recruitment channels

- Course/lab cohort (real but narrow and homogeneous — a known confound, disclose it)
- Hacker News / r/netsec / r/privacy with the disclosure page linked
- Privacy and security communities (worth targeting: these are the people who will critique the methodology hardest, which improves it)
- Institutional server logs as a secondary passive sample — **only from consenting participants' own devices**

### 6.3 Demographic/device-coverage bias (disclose prominently)

Self-selected technical audiences skew toward: desktop over mobile, Chrome over Firefox, high-end over low-end, and hardened-browser users over default. This biases entropy estimates in a known direction. Publish the device-class and browser-engine breakdown of the sample as a figure in the writeup — hiding it is how this kind of study gets invalidated.

---

## 7. System architecture

### 7.1 Component diagram

```
   Browser
      │  1. GET /                    (disclosure page — nothing collected)
      │  2. POST /api/v1/consent     (user agrees)
      │  3. load scan bundle         (only now)
      │  4. POST /api/v1/observe     (consent token attached)
      ▼
 ┌────────────────────────────────────────────┐
 │ TLS-terminating proxy                      │
 │  • Nginx / Caddy                           │
 │  • JA3 + JA4 ClientHello logging  ──► §7.2  │
 │  • forwards SSL_VERSION/CIPHER/ALPN        │
 │  • adds X-Fingerprint-Transport header      │
 └────────────────────────────────────────────┘
      ▼
 ┌────────────────────────────────────────────┐
 │ Flask app (mainApiFolder/index.py)         │
 │  index · analysis · geo · storage          │
 │  taxonomy · categories                     │
 └────────────────────────────────────────────┘
      ▼
 ┌────────────────────┐        ┌──────────────────┐
 │ SQLite (dev)       │        │ PostgreSQL (prod)│
 │ observations       │        │ + analysis schema│
 │ + vectors (EAV)    │        │ + retention job  │
 └────────────────────┘        └──────────────────┘
```

### 7.2 JA3/JA4 is the key architectural constraint

**JS cannot read the TLS ClientHello.** Any claim about transport-layer entropy is unobtainable from the Flask process alone. Options:

| Option | Trade-off |
|--------|-----------|
| **nginx + `ssl_ecdhe_curves` pin + log `$ssl_cipher`** | Partial. Correct cipher ordering via server config; fragile across versions. |
| **JA3 daemon (e.g. `salesforce/ja3`)** behind the proxy | Full fidelity. Extra component, extra ops burden. |
| **Envoy / EnvoyProxy** | Full fidelity, well-maintained, produces JA3/JA4 natively. Heavier. |
| **Skip transport layer** | RQ3 unanswerable. Acceptable fallback — state the omission. |

**Recommendation:** start by skipping it (nginx + cipher logging for a partial signal), land the JS-layer study, then add JA4 as a Phase 2 increment. Do not let transport-layer scope block the primary result.

### 7.3 GitHub Pages vs. backend

GitHub Pages can host the **frontend**, but it cannot serve as the measurement origin: it sees no TLS ClientHello, no real client IP (only edge-derived), and no custom `Accept-CH` round-trip behaviour you control. **The measurement origin must be the backend.** Repo stays on GitHub; runtime is self-hosted or a small VM. `.gitignore` already correctly excludes research data from git history — keep it that way, and note that deleting a data file later does not remove it from history, so never commit it once.

### 7.4 Module breakdown

| Module | Responsibility |
|--------|----------------|
| `mainApiFolder/index.py` | Routes, consent gate, request validation, server-side enrichment |
| `mainApiFolder/analysis.py` | UA parsing, Client Hints summary, entropy maths (Shannon, Miller–Madow, maximin, crowd size) |
| `mainApiFolder/taxonomy.py` | Vector taxonomy as structured data; `SECTIONS`, `coverage_summary()` |
| `mainApiFolder/categories.py` | Device-class and browser-engine inference with confidence |
| `mainApiFolder/geo.py` | IP normalisation, scope classification (`public`/`private`/v4-v6), GeoIP lookup honouring `GEOLOCK` |
| `mainApiFolder/storage.py` | Observation persistence, HMAC visitor ID, cohort aggregation with small-cell suppression |
| `mainApiFolder/transport.py` | **new** — parse transport fingerprint from proxy header |
| `static/js/scan.js` | Vector collection. Capability-detects; records `available: false` rather than skipping |
| `static/js/render.js` | Results UI |
| `templates/index.html` | Disclosure + consent |
| `templates/results.html` | Per-vector results, entropy, device inference |
| `tests/` | pytest: entropy correctness, consent enforcement, sanitisation, k-anonymity |

### 7.5 Storage schema

```sql
-- Immutable raw observation
CREATE TABLE observations (
  id             TEXT PRIMARY KEY,          -- uuid
  ingested_at    TIMESTAMPTZ NOT NULL,
  schema_version TEXT NOT NULL,
  visitor_id     TEXT NOT NULL,             -- HMAC-SHA256(salt, normalised_vector_set)
  consent_ts     TIMESTAMPTZ NOT NULL,      -- proof consent preceded collection
  consent_nonce  TEXT NOT NULL,
  cohort_mode    TEXT NOT NULL,             -- default | resistfp | brave_strict | tor
  payload        JSONB NOT NULL,            -- full nested record as received
  purge_after    TIMESTAMPTZ NOT NULL       -- retention deadline
);

-- Normalised long form for analysis: one row per (observation, vector_key)
CREATE TABLE vectors (
  obs_id        UUID REFERENCES observations(id) ON DELETE CASCADE,
  vector_key    TEXT NOT NULL,              -- e.g. 'graphics.webgl.renderer'
  value         TEXT NOT NULL,
  available     BOOLEAN NOT NULL,
  source        TEXT NOT NULL,              -- js | header | tls | geo
  PRIMARY KEY (obs_id, vector_key)
);
CREATE INDEX ON vectors (vector_key, value);

-- Consent receipts (no identity, just the audit trail)
CREATE TABLE consents (
  nonce      TEXT PRIMARY KEY,
  issued_at  TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  honoured   BOOLEAN NOT NULL
);
```

**Privacy note:** `visitor_id` is `HMAC-SHA256(FINGERPRINT_SALT, canonical_vector_set)`. Anyone holding the salt can recompute every visitor ID from a candidate signal set — this is why `secrets.txt` is gitignored. Rotate the salt at study boundaries; note that rotation breaks longitudinal linkage across the boundary, which is a deliberate privacy/utility trade-off, not a bug.

---

## 8. Frontend / results UI

The "device info" view the project wants, built over consented data.

**Layout:**

1. **Header** — device class (Phone / Tablet / Laptop / Desktop / Headless) with confidence, browser + engine, OS build
2. **Identifiability meter** — headline anonymity-set figure, plus the maximin attribute set that uniquely determines this visitor
3. **Vector table** — one row per vector: name, value (truncated), source, `available`, per-vector entropy across the study population
4. **Layer breakdown** — network / hints / JS entropy, contribution bars
5. **Stability panel** — self-match rates from repeat visits
6. **Transparency panel** — full disclosure of what was collected, retention, and a delete control
7. **Export** — visitor can download their own record as JSON

**UI/UX rules tied to the ethics section:** no dark patterns, decline is as prominent as agree, delete control is visible in the header (not buried in settings), and the vector table is the primary content — not a marketing page with the data hidden behind a tab.

**Responsive:** must render on Android and desktop, since the research samples both. `templates/` + vanilla JS or a light framework; no build step required for the study to run.

---

## 9. Safety invariants

These are design constraints, enforced in code and testable.

### 9.1 Consent must not be defeatable by configuration

**Current state is wrong.** `AUTO_COLLECT=true` / `REQUIRE_CONSENT=false` are the defaults, and the docstring describes consent-free collection as the project's premise.

**Required:** invert the defaults — `REQUIRE_CONSENT` defaults to `true`, `AUTO_COLLECT` defaults to `false`. `REQUIRE_CONSENT=false` may remain available for **local development only**, and the server should refuse to start with it disabled unless `FLASK_ENV=development` is also set. Consent enforcement stays server-side in `/api/v1/observe` (already correct at `index.py:315`) so that a modified client cannot bypass it.

### 9.2 Disclosure completeness

`/api/v1/schema` already returns the taxonomy as data. The disclosure page must render from **that same source**, so the published list and the actual collected set cannot drift apart. A vector in the code but not the disclosure page is a defect; add a test asserting the two match.

### 9.3 Small-cell suppression on published aggregates

`/api/v1/cohort` returns per-visitor-group counts. Its own docstring warns these are re-identifying in small cohorts — "there is only one person here from that ASN" is itself a finding that deanonymises. Suppress or coarsen any aggregate cell with `N < k` (k = 5). Default `COHORT_ENDPOINT=false`.

### 9.4 Retention

Every observation gets `purge_after`. A scheduled job purges expired rows. State the retention period on the disclosure page and enforce it.

### 9.5 Withdrawal

`DELETE /api/v1/observation/<visitor_id>` plus a UI control. Deletion must cover `observations`, `vectors` (cascade), and any derived export.

### 9.6 Repo hygiene

`.gitignore` is already correct. Add `SECURITY.md` (report vulnerabilities to the operator, not via public issues), `LICENSE`, and a `CODE_OF_CONDUCT.md`. Document that published datasets should be **synthetic or k-anonymised**, never raw.

---

## 10. Milestones

| # | Milestone | Deliverable | Depends on |
|---|-----------|-------------|-----------|
| **M0** | Safety inversion | Consent on by default, `COHORT_ENDPOINT` off, docstrings corrected, refusal to run covert mode in production | — |
| **M1** | Backend runs | Implement `analysis`, `geo`, `storage`, `taxonomy`, `categories`; add `templates/`, `static/`; `/healthz` and `/` respond | M0 |
| **M2** | Consent loop works | Disclosure page → agree → token → scan → store → results. Verified by test that a POST without a token returns 403 | M1 |
| **M3** | Vector coverage complete | All §4 groups implemented with `available` flags; `/api/v1/schema` matches the disclosure page exactly | M2 |
| **M4** | Measurement engine | `analysis.py`: Shannon, Miller–Madow, MI matrix, maximin search, Larmount–Shokri crowd size | M1 |
| **M5** | Pilot (N=50) | End-to-end validation. **No entropy claims published from this run.** | M3, M4 |
| **M6** | Main study (N≥1,000) | Recruitment, collection window, baseline comparisons | M5 |
| **M7** | Baseline runs | Firefox RFP, Brave Shields, Tor; produce H2 evidence | M6 |
| **M8** | Transport layer (Phase 2) | JA4 via Envoy/daemon; quantify RQ3 layer complementarity | M6 |
| **M9** | Stability study | Repeat visits at T+1/7/30d; retention curves | M6 |
| **M10** | Writeup | Paper/README: method, results, limitations, comparison to prior art | M7–M9 |

**Critical path:** M1 → M3 → M5 → M6. Recruitment (M6) is the schedule risk; start it during M3, not after.

---

## 11. Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Recruitment stalls below N** | Fatal to publishable claims | Start early; target technical communities; consider recruiting from a university lab as a controlled secondary cohort. Publish the N honestly and scope claims to it. |
| **Vector churn mid-study** | Distribution shift invalidates comparisons | Record `ingested_at` + `schema_version` on everything; freeze the vector set at study start; report availability drift separately |
| **Anti-fingerprinting users dominate the sample** | Underestimates real-world entropy | Recruit broadly; report cohort-mode breakdown |
| **Narrow demographic sample** | Overestimates uniqueness | Disclose device-class and engine breakdown as a figure |
| **Reviewer challenges Naive-sum entropy** | Method invalidated | §5.2: report all three methods, label the upper bound clearly |
| **Flaky vectors** (canvas, audio) | Noisy results | Fixed sample sizes and rendering ops; document determinism assumptions |
| **Battery API removal** | Vector lost mid-study | Capability detection + `available` flag; graceful category deprecation |
| **GeoIP licence** | Cannot redistribute | `*.mmdb` already gitignored; never commit the DB |
| **Salt leak** | Complete de-anonymisation possible | `secrets.txt` gitignored (already); rotate per study boundary |
| **Operator accused of covert collection** | Legal + reputational | M0 makes the consent gate the default and non-defeatable in production |

---

## 12. Limitations (to state up front in the writeup)

1. **Not the whole web.** One site, one population, self-selected. Results describe *this* deployment.
2. **Cohort-mode skew.** Hardened-browser users over-represented relative to the general public.
3. **Small N.** At N≈1,000, rare-vector entropy is poorly resolved. Confidence intervals must accompany every figure.
4. **Correlated vectors.** Naive summation overestimates; §5.2 mitigates but does not eliminate.
5. **Server-side vectors depend on proxy config.** TLS entropy varies with ciphersuite ordering and library version — not a property of the user.
6. **Platform drift.** Fingerprintability is a moving target; results have a shelf life. Version-stamp everything.
7. **Passive only.** No active probing, so these are lower bounds on browser-detectable surface.
8. **Self-reported context.** Device-class inference is an estimate; report confidence, not just a label.

---

## 13. Deliverables

- `README.md` — project overview, quickstart, disclosure page in full
- `RESEARCH_PLAN.md` — this document
- `METHODOLOGY.md` — entropy methods, formulas, estimator choices, bias discussion
- `RESULTS.md` — figures, per-vector entropy table, maximin set, stability curves
- `LIMITATIONS.md` — extracted from §12, kept current
- `templates/index.html`, `templates/results.html`, `static/js/*`
- `mainApiFolder/{index,analysis,taxonomy,categories,geo,storage,transport}.py`
- `tests/` — pytest suite covering consent enforcement, sanitisation, entropy correctness, k-anonymity
- `.env.example`, `run.sh`, `LICENSE`, `SECURITY.md`
- **k-anonymised or synthetic dataset only** — never raw participant data

---

## 14. Prior art and references

| Work | Relevance |
|------|-----------|
| Larmount & Shokri (2014), *Quantifying the Strength of Unlinking in Web-Based Tracking* — ACM TWEB | Anonymity set formula (§5.3) |
| Lagueglia, Laperdrix, Bielova, Baudry, Avoine (2017), *Browser Fingerprinting: A survey* — ACM TWEB | Taxonomy and prior entropy figures |
| Eckersley (2010), *How Unique Is Your Web Browser?* — PETS | Panopticlick; maximin method |
| Laperdrix, Bielova, Baudry, Avoine (2020), *Browser Fingerprinting: A survey* (updated) / FP-Block | Caenor; modern entropy estimates |
| Egelman et al. (2014), *How Many Hearts Do You Have?* — NDSS | Unique-identifier combinations |
| RFC 8941 + W3C Client Hints spec | `Sec-CH-UA-*` semantics |
| Salesforce JA3, FoxIT JA4 | Transport-layer fingerprinting |
| Mozilla `privacy.resistFingerprinting` docs | H2 baseline semantics |
| Larmount, Hoogh, Leijssen (2018), *A framework for ethical privacy research* | Justifies the consent architecture |

---

## 15. Immediate next actions

1. **M0** — invert the collection defaults and correct the docstrings in `index.py`. This is small, and it is the difference between a research instrument and a covert surveillance tool.
2. **M1** — implement the five missing modules and the frontend templates so the server actually boots.
3. Add `pytest` covering consent enforcement and sanitisation before any data is collected.
4. Start recruitment planning for M6 in parallel with M3.

---

*Plan status: initial. Update §10 as milestones close and §12 as limitations become known.*