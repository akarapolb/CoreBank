"""Build a single HTML file of the console prototype that runs with no internet: styles, scripts and fonts inlined.

    python build-offline.py            # uses fonts/ if present, downloading them once from Google Fonts otherwise
    -> offline/fabor-console.html      # open it from disk in any modern browser

The fonts (Geist, Geist Mono, Bricolage Grotesque, IBM Plex Sans Thai) are under the SIL Open Font License.
"""
import base64, pathlib, re, urllib.request

HERE = pathlib.Path(__file__).resolve().parent
FONTS = HERE / "fonts"
OUT = HERE / "offline" / "fabor-console.html"
SCRIPTS = ["core.js", "data.js", "views.js", "records.js", "flows.js", "lending.js", "shell.js"]
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"}


def fetch_fonts(css_url: str) -> None:
    """Download the latin and thai woff2 files the page uses and write fonts/fonts.css pointing at them."""
    FONTS.mkdir(exist_ok=True)
    css = urllib.request.urlopen(urllib.request.Request(css_url, headers=UA), timeout=30).read().decode()
    # variable fonts come back as one file listed once per weight: keep one face per file, spanning the weights
    faces = {}
    for subset, block in re.findall(r"/\* ([\w-]+) \*/\s*(@font-face \{.*?\})", css, re.S):
        if subset not in ("latin", "thai"):
            continue
        url = re.search(r"url\((https://[^)]+)\)", block).group(1)
        weights = [int(w) for w in re.search(r"font-weight: ([\d ]+);", block).group(1).split()]
        if url in faces:
            faces[url]["weights"] += weights
            continue
        family = re.search(r"font-family: '([^']+)'", block).group(1)
        name = f"{family.replace(' ', '')}-{subset}-{len(faces)}.woff2"
        (FONTS / name).write_bytes(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read())
        faces[url] = {"block": block, "name": name, "weights": weights}
    out = []
    for url, f in faces.items():
        lo, hi = min(f["weights"]), max(f["weights"])
        block = re.sub(r"font-weight: [\d ]+;", f"font-weight: {lo} {hi};" if lo != hi else f"font-weight: {lo};", f["block"])
        out.append(block.replace(url, f["name"]))
    (FONTS / "fonts.css").write_text("\n".join(out) + "\n", encoding="utf-8")


def inline_fonts() -> str:
    css = (FONTS / "fonts.css").read_text(encoding="utf-8")
    return re.sub(r"url\(([\w.-]+\.woff2)\)", lambda m: "url(data:font/woff2;base64," + base64.b64encode((FONTS / m.group(1)).read_bytes()).decode() + ")", css)


def main() -> None:
    page = (HERE / "index.html").read_text(encoding="utf-8")
    font_link = re.search(r'<link rel="stylesheet" href="(https://fonts\.googleapis\.com/[^"]+)">', page).group(1)
    if not (FONTS / "fonts.css").exists():
        fetch_fonts(font_link.replace("&amp;", "&"))
    page = re.sub(r'<link rel="preconnect"[^>]*>\n?', "", page)
    page = page.replace(f'<link rel="stylesheet" href="{font_link}">', "<style>\n" + inline_fonts() + "</style>")
    page = page.replace('<link rel="stylesheet" href="styles.css">', "<style>\n" + (HERE / "styles.css").read_text(encoding="utf-8") + "</style>")
    for name in SCRIPTS:
        page = page.replace(f'<script src="js/{name}"></script>', "<script>\n" + (HERE / "js" / name).read_text(encoding="utf-8") + "</script>")
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text('<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
                   "<style>[hidden]{display:none!important}body{margin:0}</style>\n" + page + "\n</html>\n", encoding="utf-8")
    print(f"{OUT.relative_to(HERE)} · {OUT.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
