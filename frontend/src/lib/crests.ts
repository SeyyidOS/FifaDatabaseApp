/**
 * Club crests (from each club's Wikipedia article, resized to 192px WebP) served from public/crests.
 * Fetched by scripts/fetch-crests.py; names are matched case- and accent-insensitively.
 */
const FILES: Record<string, string> = {
  "ac milan": "ac-milan.webp",
  "ajax": "ajax.webp",
  "arsenal": "arsenal.webp",
  "as monaco": "as-monaco.webp",
  "as roma": "as-roma.webp",
  "aston villa": "aston-villa.webp",
  "atalanta": "atalanta.webp",
  "athletic bilbao": "athletic-bilbao.webp",
  "atletico madrid": "atletico-madrid.webp",
  "barcelona": "barcelona.webp",
  "basaksehir": "basaksehir.webp",
  "bayer leverkusen": "bayer-leverkusen.webp",
  "bayern munich": "bayern-munich.webp",
  "benfica": "benfica.webp",
  "besiktas": "besiktas.webp",
  "borussia dortmund": "borussia-dortmund.webp",
  "bournemouth": "bournemouth.webp",
  "brentford": "brentford.webp",
  "brighton & hove albion": "brighton-hove-albion.webp",
  "celtic": "celtic.webp",
  "chelsea": "chelsea.webp",
  "club brugge": "club-brugge.webp",
  "como": "como.webp",
  "corum fk": "corum-fk.webp",
  "crystal palace": "crystal-palace.webp",
  "eintracht frankfurt": "eintracht-frankfurt.webp",
  "everton": "everton.webp",
  "fenerbahce": "fenerbahce.webp",
  "feyenoord": "feyenoord.webp",
  "fiorentina": "fiorentina.webp",
  "galatasaray": "galatasaray.webp",
  "hoffenheim": "hoffenheim.webp",
  "inter milan": "inter-milan.webp",
  "juventus fc": "juventus-fc.webp",
  "leeds united": "leeds-united.webp",
  "lille": "lille.webp",
  "liverpool": "liverpool.webp",
  "manchester city": "manchester-city.webp",
  "manchester united": "manchester-united.webp",
  "napoli": "napoli.webp",
  "newcastle united": "newcastle-united.webp",
  "nottingham forest": "nottingham-forest.webp",
  "olympiacos": "olympiacos.webp",
  "olympique de marseille": "olympique-de-marseille.webp",
  "olympique lyonnais": "olympique-lyonnais.webp",
  "panathinaikos": "panathinaikos.webp",
  "paok": "paok.webp",
  "paris saint-germain": "paris-saint-germain.webp",
  "porto": "porto.webp",
  "psv": "psv.webp",
  "rayo vallecano": "rayo-vallecano.webp",
  "rb leipzig": "rb-leipzig.webp",
  "real betis": "real-betis.webp",
  "real madrid": "real-madrid.webp",
  "real sociedad": "real-sociedad.webp",
  "rennes": "rennes.webp",
  "sevilla": "sevilla.webp",
  "sporting cp": "sporting-cp.webp",
  "ss lazio": "ss-lazio.webp",
  "strasbourg": "strasbourg.webp",
  "tottenham hotspur": "tottenham-hotspur.webp",
  "trabzonspor": "trabzonspor.webp",
  "valencia": "valencia.webp",
  "vfb stuttgart": "vfb-stuttgart.webp",
  "villarreal cf": "villarreal-cf.webp",
  "west ham united": "west-ham-united.webp",
  "wolverhampton wanderers": "wolverhampton-wanderers.webp",
};

const ALIASES: Record<string, string> = {
  "atl\u00e9tico madrid": "atletico madrid",
  "bayern": "bayern munich",
  "be\u015fikta\u015f": "besiktas",
  "dortmund": "borussia dortmund",
  "fenerbah\u00e7e": "fenerbahce",
  "inter": "inter milan",
  "juventus": "juventus fc",
  "lazio": "ss lazio",
  "leverkusen": "bayer leverkusen",
  "losc": "lille",
  "lyon": "olympique lyonnais",
  "man city": "manchester city",
  "man united": "manchester united",
  "marseille": "olympique de marseille",
  "psg": "paris saint-germain",
  "psv eindhoven": "psv",
  "roma": "as roma",
  "tottenham": "tottenham hotspur",
  "villarreal": "villarreal cf",
};

/** Single-colour dark crests that are drawn white on dark backgrounds. */
const MONO = new Set(["juventus fc", "tottenham hotspur"]);

const normalise = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export interface Crest {
  src: string;
  mono: boolean;
}

export function crestFor(name: string): Crest | null {
  const raw = name.trim().toLowerCase();
  const n = normalise(name);
  const key = [raw, n, ALIASES[raw], ALIASES[n]].find((k) => k && FILES[k]);
  if (!key) return null;
  return { src: `${import.meta.env.BASE_URL}crests/${FILES[key]}`, mono: MONO.has(key) };
}
