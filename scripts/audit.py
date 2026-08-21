import os, re, json, subprocess, pathlib
ROOT = pathlib.Path("src/app")

def route_of(p: pathlib.Path) -> str:
    r = str(p.parent).replace("src/app", "")
    r = re.sub(r"/\((?:[^)]*)\)", "", r)   # strip (groups)
    return r or "/"

# Collect the component files each page pulls in from @/components, one level deep,
# because the interactive elements mostly live there, not in the page file.
def local_imports(src: str):
    return re.findall(r'from "@/components/([^"]+)"', src)

def submitted_names(src: str):
    """
    Only the `name=` attributes that actually sit inside a <form>.

    A `name` is what the server receives; a `name` outside a form is markup, not
    behaviour. Radio groups need one purely so arrow keys move between the
    options, and counting those as form fields made this gate report a change
    when the restyle had changed nothing submitted — which is how a parity check
    stops being read and starts being rubber-stamped.
    """
    spans = []
    for m in re.finditer(r"<form\b", src):
        close = src.find("</form>", m.start())
        if close != -1:
            spans.append((m.start(), close))
    names = []
    for m in re.finditer(r'name="([^"]+)"', src):
        if any(a <= m.start() <= b for a, b in spans):
            names.append(m.group(1))
    return names


def scan(src: str):
    return {
        "links":   sorted(set(re.findall(r'href=\{?["`]([^"`{}]+)["`]', src))),
        "actions": sorted(set(re.findall(r'action=\{(\w+)\}', src))),
        "fields":  sorted(set(submitted_names(src))),
        "onclick": sorted(set(re.findall(r'on(?:Click|Submit|Change)=\{\(?\)?\s*=?>?\s*(\w+)', src))),
    }

rows = []
for page in sorted(ROOT.rglob("page.tsx")):
    src = page.read_text()
    agg = scan(src)
    seen = set()
    for imp in local_imports(src):
        for ext in (".tsx", "/index.tsx"):
            f = pathlib.Path("src/components") / (imp + ext)
            if f.exists() and str(f) not in seen:
                seen.add(str(f))
                sub = scan(f.read_text())
                for k in agg:
                    agg[k] = sorted(set(agg[k]) | set(sub[k]))
    rows.append({"route": route_of(page), "file": str(page), **agg,
                 "components": sorted(seen)})

out = ["# AUDIT.md — pre-reskin parity checklist",
"",
"Generated from source, not written by hand: `scripts/audit.py` walks every",
"`page.tsx` under `src/app`, plus the `@/components/*` files each one imports one",
"level deep — most interactive elements live in those, not in the page file.",
"",
"This is the checklist the reskin is verified against. A restyle may change markup",
"structure, classes and wrappers freely; it may not change what is in these",
"columns. Regenerate after each surface and diff against this baseline:",
"",
"```bash",
"python3 scripts/audit.py > AUDIT.md && git diff --stat AUDIT.md",
"```",
"",
"A non-empty diff means the reskin changed behaviour, and that is a bug unless it",
"was explicitly asked for.",
"",
f"**{len(rows)} pages.**",
"",
"| Route | Links | Server actions | Submitted fields | Handlers |",
"|---|---|---|---|---|"]

def cell(xs, lim=14):
    if not xs: return "—"
    s = ", ".join(f"`{x}`" for x in xs[:lim])
    return s + (f" _+{len(xs)-lim}_" if len(xs) > lim else "")

for r in rows:
    out.append(f"| `{r['route']}` | {cell(r['links'])} | {cell(r['actions'])} | {cell(r['fields'])} | {cell(r['onclick'])} |")

print("\n".join(out))
