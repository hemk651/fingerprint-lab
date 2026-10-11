#!/usr/bin/env python3
"""Verify the Fingerprint Lab with no dependencies at all.

Checks that are possible without a browser:

  1. Every JavaScript file parses.
  2. Every relative import resolves to a file that exists.
  3. The probe registry has no duplicate IDs and every probe is well-formed.
  4. Every probe family referenced by a probe exists in the entropy model.
  5. The HTML references only files that exist.
  6. The standalone build is in step with the sources, if it has been built.
  7. The disclosure and the implementation agree — no network APIs, no
     external resources.

Run:  python3 tools/verify.py
Exit: 0 if everything passes, 1 otherwise.

No third-party packages, no npm, no network access. Uses only the standard
library, so it runs on any machine with Python 3.9+.
"""

from __future__ import annotations

import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
JS = DOCS / "src" / "js"
PROBES = JS / "probes"
DIST = ROOT / "dist" / "fingerprint-lab.html"

# ES module syntax Node accepts but we do not use. Kept explicit so a new
# construct has to be added deliberately rather than silently allowed.
IMPORT_RE = re.compile(
    r"""^[ \t]*import\s+(?:(?P<clause>[\s\S]*?)\s+from\s+)?["'](?P<spec>[^"']+)["']\s*;?[ \t]*$""",
    re.MULTILINE,
)
DYNAMIC_IMPORT_RE = re.compile(r"""\bimport\s*\(\s*["']([^"']+)["']\s*\)""")

# Patterns that indicate an actual network call. Deliberately require a call
# or construction rather than a bare identifier: features.js lists
# "XMLHttpRequest" and "sendBeacon" as strings to test for API presence, and
# that is detection, not use.
NETWORK_APIS = (
    r"\bfetch\s*\(",
    r"\bnew\s+XMLHttpRequest\b",
    r"\bnew\s+WebSocket\b",
    r"\bnew\s+EventSource\b",
    r"\bnavigator\.sendBeacon\s*\(",
    r"\bimportScripts\s*\(",
    r"\bnavigator\.geolocation\.\w+\s*\(",
    r"\bnavigator\.getUserMedia\s*\(",
    r"\bnavigator\.getBattery\s*\(",
    r"\bnavigator\.bluetooth\.requestDevice\s*\(",
    r"\bnavigator\.usb\.requestDevice\s*\(",
    r"\bnavigator\.serial\.requestPort\s*\(",
)

EXTERNAL_URL_RE = re.compile(r"""(?:src|href)\s*=\s*["'](https?:)?//""", re.IGNORECASE)

failures: list[str] = []
notes: list[str] = []

node_available = shutil.which("node") is not None


def fail(msg: str) -> None:
    failures.append(msg)


def section(title: str) -> None:
    print(f"\n{title}")
    print("-" * len(title))


# ----------------------------------------------------------------------
# 1. Syntax
# ----------------------------------------------------------------------

def check_syntax() -> int:
    section("JavaScript syntax")
    files = sorted(JS.rglob("*.js")) + sorted((ROOT / "tools").glob("*.mjs"))
    bad = 0
    for f in files:
        src = f.read_text(encoding="utf-8")
        rel = f.relative_to(ROOT)
        # Balance counting is not attempted here. Regex literals and division
        # make brace/paren counting unreliable without a real parser, and a
        # wrong answer is worse than no answer. If node is available it is
        # used as the actual oracle; otherwise the check is skipped rather
        # than guessed at.
        if node_available:
            proc = subprocess.run(
                ["node", "--check", str(f)],
                capture_output=True, text=True,
            )
            if proc.returncode != 0:
                first = (proc.stderr.strip().splitlines() or ["syntax error"])[0]
                fail(f"{rel}: {first}")
                bad += 1
        if re.search(r"^[ \t]*export\s+default\b", src, re.MULTILINE):
            fail(f"{rel}: uses 'export default', which the standalone bundler does not support")
            bad += 1
    if node_available:
        print(f"  {len(files)} files parsed with node --check, {bad} problems")
    else:
        print(f"  {len(files)} files scanned; node not found, syntax check skipped")
    return len(files)


# ----------------------------------------------------------------------
# 2. Imports resolve
# ----------------------------------------------------------------------

def check_imports() -> int:
    section("Import graph")
    files = sorted(JS.rglob("*.js"))
    total = 0
    dangling = 0
    for f in files:
        src = f.read_text(encoding="utf-8")
        specs = [m.group("spec") for m in IMPORT_RE.finditer(src)]
        specs += DYNAMIC_IMPORT_RE.findall(src)
        for spec in specs:
            total += 1
            if spec.startswith("."):
                target = (f.parent / spec).resolve()
                if not target.exists():
                    fail(f"{f.relative_to(ROOT)}: import '{spec}' does not exist")
                    dangling += 1
            else:
                # A bare specifier would mean a bundled dependency. The project
                # has none by design: it is what lets the page run with no
                # network and no install step.
                fail(f"{f.relative_to(ROOT)}: bare import '{spec}' — the site must have zero dependencies")
                dangling += 1
    print(f"  {total} imports checked, {dangling} problems")
    return total


# ----------------------------------------------------------------------
# 3-4. Probe registry and families
# ----------------------------------------------------------------------

PROBE_ID_RE = re.compile(r"""id:\s*["']([^"']+)["']""")
PROBE_LABEL_RE = re.compile(
    r"""label:\s*(?:\n\s*)?["']([^"']+)["']""",
)
FAMILY_RE = re.compile(r"""family:\s*["']([^"']+)["']""")
BITS_RE = re.compile(r"""\bbits:\s*([0-9.]+)""")
FAMILIES_IN_MODEL_RE = re.compile(r"""^\s{2}([a-z]+):\s*\{""", re.MULTILINE)


def check_probes() -> tuple[int, int]:
    section("Probe registry")
    probe_files = sorted(p for p in PROBES.glob("*.js") if p.name != "index.js")

    ids: list[str] = []
    families: set[str] = set()
    bits_total = 0.0

    for f in probe_files:
        src = f.read_text(encoding="utf-8")
        rel = f.relative_to(ROOT)
        if "export const probe" not in src and "createPageInteractionProbe" not in src:
            fail(f"{rel}: does not export a probe")
        m = PROBE_ID_RE.search(src)
        if not m:
            fail(f"{rel}: probe has no id")
            continue
        ids.append(m.group(1))

        fam = FAMILY_RE.search(src)
        if not fam:
            fail(f"{rel}: probe has no family")
        else:
            families.add(fam.group(1))

        bits = BITS_RE.search(src)
        if not bits:
            fail(f"{rel}: probe has no bits value")
        else:
            bits_total += float(bits.group(1))

    dupes = {i for i in ids if ids.count(i) > 1}
    for d in sorted(dupes):
        fail(f"duplicate probe id: '{d}'")

    # Every probe module must be imported by the registry AND its local alias
    # must appear in the PROBES array. Modules alias on import
    # (`import { probe as adblockDetect } from "./adblock-detect.js"`), so the
    # array entry is the alias, not the filename stem.
    index_src = (PROBES / "index.js").read_text(encoding="utf-8")

    # module path -> the local name it is bound to
    alias_re = re.compile(
        r"""import\s*\{[^}]*\bas\s+([A-Za-z_$][\w$]*)[^}]*\}\s*from\s*["']\./([^"']+)["']"""
    )
    bound = {m.group(2): m.group(1) for m in alias_re.finditer(index_src)}

    # Modules that export a factory (createPageInteractionProbe) rather than a
    # `probe` object. These appear in the array as a call, not a bare name.
    factory_re = re.compile(
        r"""import\s*\{([^}]*)\}\s*from\s*["']\./([^"']+)["']"""
    )
    factories = set()
    for m in factory_re.finditer(index_src):
        imported = [p.strip() for p in m.group(1).split(",") if p.strip()]
        if any(name.startswith("create") for name in imported):
            factories.add(m.group(2))

    for f in probe_files:
        module_path = f"./{f.name}"
        if module_path not in index_src:
            fail(f"{f.relative_to(ROOT)} is not imported by probes/index.js")
            continue
        if f.name in factories:
            # Must appear in the array as a call, e.g. `createXProbe(),`
            if not any(
                re.search(rf"^\s{{2}}{re.escape(n)}\(\),\s*$", index_src, re.MULTILINE)
                for m in factory_re.finditer(index_src)
                if m.group(2) == f.name
                for n in [p.strip() for p in m.group(1).split(",") if p.strip()]
                if n.startswith("create")
            ):
                fail(f"{f.relative_to(ROOT)} exports a factory but is not invoked in the PROBES array")
            continue
        local = bound.get(f.name, f.stem)
        if not re.search(rf"^\s{{2}}{re.escape(local)},\s*$", index_src, re.MULTILINE):
            fail(f"{f.relative_to(ROOT)} is imported as '{local}' but not listed in the PROBES array")

    print(f"  {len(probe_files)} probe files, {len(ids)} probes, {len(families)} families")
    print(f"  nominal bit total: {bits_total:.1f}")
    return len(ids), len(families)


def check_families() -> None:
    section("Entropy model families")
    model = (JS / "entropy.js").read_text(encoding="utf-8")
    model_families = set(FAMILIES_IN_MODEL_RE.findall(model.split("};", 1)[0]))

    probe_files = sorted(p for p in PROBES.glob("*.js") if p.name != "index.js")
    used: set[str] = set()
    for f in probe_files:
        m = FAMILY_RE.search(f.read_text(encoding="utf-8"))
        if m:
            used.add(m.group(1))

    missing = used - model_families
    for fam in sorted(missing):
        fail(f"probe family '{fam}' is not defined in entropy.js FAMILIES")

    unused = model_families - used
    for fam in sorted(unused):
        notes.append(f"family '{fam}' is defined in the entropy model but no probe uses it")

    print(f"  model defines {len(model_families)}: {', '.join(sorted(model_families))}")
    print(f"  probes use    {len(used)}: {', '.join(sorted(used))}")


# ----------------------------------------------------------------------
# 5. HTML references
# ----------------------------------------------------------------------

def check_html() -> None:
    section("HTML references")
    html = (DOCS / "index.html").read_text(encoding="utf-8")

    refs = re.findall(r"""(?:src|href)\s*=\s*["']([^"':#][^"']*)["']""", html)
    missing = 0
    for ref in refs:
        if ref.startswith(("http://", "https://", "//", "data:", "mailto:")):
            continue
        target = (DOCS / ref).resolve()
        if not target.exists():
            fail(f"index.html references missing file: {ref}")
            missing += 1
    print(f"  {len(refs)} local references, {missing} missing")


# ----------------------------------------------------------------------
# 6. Standalone build freshness
# ----------------------------------------------------------------------

def check_standalone() -> None:
    section("Standalone build")
    if not DIST.exists():
        notes.append("dist/fingerprint-lab.html not built yet — run: python3 tools/build.py")
        print("  not built (run the build script)")
        return

    built = DIST.read_text(encoding="utf-8")
    print(f"  {DIST.relative_to(ROOT)}  ({len(built) / 1024:.0f} KB)")

    # Every probe label should appear in the built file, proving the probes
    # were inlined rather than left as a broken import.
    for f in sorted(p for p in PROBES.glob("*.js") if p.name != "index.js"):
        m = PROBE_ID_RE.search(f.read_text(encoding="utf-8"))
        if m and m.group(1) not in built:
            fail(f"probe '{m.group(1)}' missing from the standalone build — rebuild it")

    if "__def(" not in built:
        fail("standalone build has no module runtime — rebuild it")

    leftover = re.findall(r"""<script[^>]+src=|<link[^>]+stylesheet""", built)
    for tag in leftover:
        fail(f"standalone build still references an external file: {tag}")

    print("  module runtime present, no external references")


# ----------------------------------------------------------------------
# 7. Privacy invariants
# ----------------------------------------------------------------------

def check_privacy() -> None:
    section("Privacy invariants")
    # This is the project's central claim, so it is asserted rather than
    # asserted-in-prose.
    offenders: list[str] = []

    for f in sorted(JS.rglob("*.js")):
        src = f.read_text(encoding="utf-8")
        # Strip comments and string literals: prose describing a blocked API
        # and string literals naming an API to test for are not calls.
        code = re.sub(r"/\*[\s\S]*?\*/", "", src)
        code = re.sub(r"//[^\n]*", "", code)
        code = re.sub(r'"(?:[^"\\]|\\.)*"', '""', code)
        code = re.sub(r"'(?:[^'\\]|\\.)*'", "''", code)
        code = re.sub(r"`(?:[^`\\]|\\.)*`", "``", code)
        for api in NETWORK_APIS:
            if re.search(api, code):
                offenders.append(f"{f.relative_to(ROOT)} matches {api}")

    for o in offenders:
        fail(f"network API in shipped code: {o}")

    html = (DOCS / "index.html").read_text(encoding="utf-8")
    for m in EXTERNAL_URL_RE.finditer(html):
        fail(f"index.html loads an external resource: {m.group(0)}")

    if "assets/css/main.css" not in html:
        fail("index.html does not load the stylesheet")

    print(f"  {len(offenders)} network APIs in shipped code")
    print(f"  external resources in index.html: 0" if not EXTERNAL_URL_RE.search(html) else "  external resources FOUND")


# ----------------------------------------------------------------------
# Probe labels (a light sanity check that probes are populated)
# ----------------------------------------------------------------------

def check_probe_labels() -> None:
    section("Probe labels")
    # Labels live on the probe objects in each probe file, not in the
    # registry — the registry only wires them together.
    found: list[str] = []
    for f in sorted(p for p in PROBES.glob("*.js") if p.name != "index.js"):
        m = PROBE_LABEL_RE.search(f.read_text(encoding="utf-8"))
        if m:
            found.append(m.group(1))
        else:
            notes.append(f"{f.name}: probe has no human-readable label")
    print(f"  {len(found)} labels across {len(found)} probe files")


def main() -> int:
    print("Fingerprint Lab — dependency-free verification")
    print("=" * 46)

    check_syntax()
    check_imports()
    n_probes, n_families = check_probes()
    check_families()
    check_html()
    check_probe_labels()
    check_standalone()
    check_privacy()

    print("\n" + "=" * 46)
    if notes:
        print("Notes:")
        for n in notes:
            print(f"  · {n}")

    if failures:
        print(f"\nFAIL — {len(failures)} problem(s):")
        for f in failures:
            print(f"  ✗ {f}")
        return 1

    print(f"\nPASS — {n_probes} probes, {n_families} families, no problems")
    print("Zero dependencies: no npm, no pip packages, no network.")
    return 0


if __name__ == "__main__":
    sys.exit(main())