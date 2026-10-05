"""Download club crests from each club's Wikipedia article into public/crests (192px WebP).

Usage: python3 scripts/fetch-crests.py manifest.json   (needs Pillow; skips files that already exist)
Add a club to TITLES (display name -> Wikipedia article), run it, then add the file to src/lib/crests.ts.
"""
import io, json, re, sys, time, urllib.parse, urllib.request
from PIL import Image
UA = {"User-Agent": "FifaManagerCrests/1.0 (personal hobby project)"}
OUT = __import__("os").path.join(__import__("os").path.dirname(__file__), "..", "public", "crests")
TITLES = {
 "Arsenal": "Arsenal F.C.", "Barcelona": "FC Barcelona", "Bayern Munich": "FC Bayern Munich",
 "Bournemouth": "AFC Bournemouth", "Brentford": "Brentford F.C.", "Celtic": "Celtic F.C.", "Como": "Como 1907",
 "Hoffenheim": "TSG 1899 Hoffenheim", "Inter Milan": "Inter Milan", "Leeds United": "Leeds United F.C.",
 "Liverpool": "Liverpool F.C.", "Manchester City": "Manchester City F.C.", "Olympiacos": "Olympiacos F.C.",
 "Paris Saint-Germain": "Paris Saint-Germain F.C.", "Porto": "FC Porto", "Rayo Vallecano": "Rayo Vallecano",
 "Valencia": "Valencia CF", "Aston Villa": "Aston Villa F.C.", "Atletico Madrid": "Atlético Madrid",
 "Bayer Leverkusen": "Bayer 04 Leverkusen", "Chelsea": "Chelsea F.C.", "Manchester United": "Manchester United F.C.",
 "Newcastle United": "Newcastle United F.C.", "Tottenham Hotspur": "Tottenham Hotspur F.C.", "AC Milan": "AC Milan",
 "Atalanta": "Atalanta BC", "Athletic Bilbao": "Athletic Bilbao", "Benfica": "S.L. Benfica",
 "Borussia Dortmund": "Borussia Dortmund", "Napoli": "SSC Napoli", "Nottingham Forest": "Nottingham Forest F.C.",
 "PSV": "PSV Eindhoven", "RB Leipzig": "RB Leipzig", "Sporting CP": "Sporting CP", "AS Roma": "AS Roma",
 "Crystal Palace": "Crystal Palace F.C.", "Eintracht Frankfurt": "Eintracht Frankfurt", "Juventus FC": "Juventus FC",
 "Olympique Lyonnais": "Olympique Lyonnais", "Olympique de Marseille": "Olympique de Marseille",
 "Real Betis": "Real Betis", "Real Sociedad": "Real Sociedad", "SS Lazio": "SS Lazio", "Villarreal CF": "Villarreal CF",
 "West Ham United": "West Ham United F.C.",
 # common picks not in the table yet (custom club names still resolve)
 "Real Madrid": "Real Madrid CF", "Galatasaray": "Galatasaray S.K.", "Fenerbahce": "Fenerbahçe S.K.",
 "Besiktas": "Beşiktaş J.K.", "Trabzonspor": "Trabzonspor", "Ajax": "AFC Ajax", "Feyenoord": "Feyenoord",
 "Sevilla": "Sevilla FC", "Fiorentina": "ACF Fiorentina", "Everton": "Everton F.C.",
 "Brighton & Hove Albion": "Brighton & Hove Albion F.C.", "Wolverhampton Wanderers": "Wolverhampton Wanderers F.C.",
 "VfB Stuttgart": "VfB Stuttgart", "AS Monaco": "AS Monaco FC", "Lille": "Lille OSC",
}
slug = lambda s: re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
import os, urllib.error
def get(url, tries=6):
    for i in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or i == tries - 1: raise
            wait = int(e.headers.get("Retry-After") or 0) or 5 * (i + 1)
            print(f"  429, waiting {wait}s", flush=True); time.sleep(wait)
manifest, report = {}, []
for name, title in TITLES.items():
    if os.path.exists(f"{OUT}/{slug(name)}.webp"):
        manifest[name.lower()] = slug(name) + ".webp"; report.append(f"have {name}"); continue
    q = urllib.parse.urlencode({"action": "query", "format": "json", "redirects": 1, "prop": "pageimages",
        "piprop": "thumbnail|name", "pithumbsize": 330, "pilicense": "any", "titles": title})
    page = list(json.loads(get("https://en.wikipedia.org/w/api.php?" + q))["query"]["pages"].values())[0]
    src = page.get("thumbnail", {}).get("source")
    if not src:
        report.append(f"MISSING {name} ({title})"); continue
    img = Image.open(io.BytesIO(get(src))).convert("RGBA")
    img.thumbnail((192, 192), Image.LANCZOS)
    bbox = img.getbbox()
    if bbox: img = img.crop(bbox)
    fn = slug(name) + ".webp"
    img.save(f"{OUT}/{fn}", "WEBP", quality=90, method=6)
    manifest[name.lower()] = fn
    report.append(f"ok  {name:24s} {page.get('pageimage')}")
    time.sleep(1.5)
json.dump(manifest, open(sys.argv[1], "w"), indent=1, sort_keys=True)
print("\n".join(report))
