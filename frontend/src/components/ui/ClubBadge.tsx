import { useId, type ReactNode } from "react";
import { kitFor, luminance, type BadgeStyle, type Kit } from "../../lib/kits";

// everything is drawn on a 40 x 46 grid
const SHIRT =
  "M14.5 5C16 7.2 17.8 8.4 20 8.4S24 7.2 25.5 5L33.2 7.6Q35 8.3 35.9 9.9L39 16.6 34.6 20.4 31.4 17.8V41.2Q20 43.4 8.6 41.2V17.8L5.4 20.4 1 16.6 4.1 9.9Q5 8.3 6.8 7.6Z";
const SLEEVES =
  "M9.6 6.4 6.8 7.6Q5 8.3 4.1 9.9L1 16.6 5.4 20.4 8.6 17.8ZM30.4 6.4 33.2 7.6Q35 8.3 35.9 9.9L39 16.6 34.6 20.4 31.4 17.8Z";
const CUFFS = "M1 16.6 5.4 20.4 6.4 19.2 2 15.4ZM39 16.6 34.6 20.4 33.6 19.2 38 15.4Z";
const COLLAR = "M14.5 5C16 7.2 17.8 8.4 20 8.4S24 7.2 25.5 5L23.7 4.5C22.7 6 21.5 6.7 20 6.7S17.3 6 16.3 4.5Z";
const NECK = "M16.3 4.5C17.3 6 18.5 6.7 20 6.7S22.7 6 23.7 4.5Q20 3.3 16.3 4.5Z";
const SEAMS = "M9.6 6.4 8.6 17.8M30.4 6.4 31.4 17.8";
/** a small five-pointed star, its top at (20, 0) */
const STAR = "M20 0 21 2.2 23.4 2.4 21.6 3.9 22.2 6.2 20 5 17.8 6.2 18.4 3.9 16.6 2.4 19 2.2Z";
const SHIELD = "M3 6.8Q20 1.2 37 6.8V22.4C37 33.8 29.6 40.8 20 44.6 10.4 40.8 3 33.8 3 22.4Z";

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) as [number, number, number];
}

/** `a` moved towards `b` by t (0..1) */
function mix(a: string, b: string, t: number): string {
  const [x, y] = [hexToRgb(a), hexToRgb(b)];
  return `#${x.map((c, i) => Math.round(c + (y[i] - c) * t).toString(16).padStart(2, "0")).join("")}`;
}

/** A deep version of the kit's darkest colour, for a badge's frame; not the body's when that's near black too. */
function deep(kit: Kit): string {
  const plainDark = kit.pattern === "plain" && luminance(kit.body) < 0.03;
  const colours = plainDark ? [kit.accent, kit.trim] : [kit.body, kit.accent, kit.trim];
  const darkest = colours.sort((a, b) => luminance(a) - luminance(b))[0];
  return luminance(darkest) > 0.06 ? mix(darkest, "#0a0d16", 0.45) : mix(darkest, "#0a0d16", 0.2);
}

const inkOn = (hex: string) => (luminance(hex) > 0.42 ? "#0b0f17" : "#ffffff");

/** The kit's pattern over the whole grid; the caller clips it to its shape. */
function Pattern({ kit, shirt = false }: { kit: Kit; shirt?: boolean }) {
  const { pattern, body, accent, edge } = kit;
  let over: ReactNode = null;
  switch (pattern) {
    case "stripes":
      over = range(-5, 5)
        .filter((k) => k % 2 !== 0)
        .map((k) => <rect key={k} x={18 + k * 4} width="4" height="46" fill={accent} />);
      break;
    case "hoops":
      over = range(0, 10)
        .filter((k) => k % 2 === 1)
        .map((k) => <rect key={k} y={shirt ? 3 + k * 4.2 : 2.6 + k * 4.2} width="40" height="4.2" fill={accent} />);
      break;
    case "halves":
      over = <rect x="20" width="20" height="46" fill={accent} />;
      break;
    case "sleeves":
      over = shirt ? (
        <path d={SLEEVES} fill={accent} />
      ) : (
        <path d="M0 0H10.5V46H0ZM29.5 0H40V46H29.5Z" fill={accent} />
      );
      break;
    case "band":
      over = (
        <>
          {edge && <rect x="15" width="10" height="46" fill={edge} />}
          <rect x="16.2" width="7.6" height="46" fill={accent} />
        </>
      );
      break;
    case "sash":
      over = <path d="M11 2.5 18 2.5 36 46 27 46Z" fill={accent} transform={shirt ? undefined : "translate(-1 0)"} />;
      break;
    case "chest":
      over = <rect y={shirt ? 15.5 : 19} width="40" height={shirt ? 6 : 8} fill={accent} />;
      break;
    case "diagonal":
      over = <path d="M44 0H50V50H-6Z" fill={accent} />;
      break;
  }
  return (
    <>
      <rect width="40" height="46" fill={body} />
      {over}
    </>
  );
}

function KitBadge({ kit, id }: { kit: Kit; id: string }) {
  return (
    <>
      <defs>
        <clipPath id={`c${id}`}>
          <path d={SHIRT} />
        </clipPath>
        <linearGradient id={`v${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.24" />
          <stop offset="0.42" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id={`h${id}`} x1="8.6" x2="31.4" y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#000" stopOpacity="0.22" />
          <stop offset="0.24" stopColor="#000" stopOpacity="0" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.26" />
        </linearGradient>
      </defs>
      <path d={NECK} fill={mix(kit.body, "#000000", 0.45)} />
      <g clipPath={`url(#c${id})`}>
        <Pattern kit={kit} shirt />
        <path d={SLEEVES} fill="#000" opacity="0.1" />
        <rect width="40" height="46" fill={`url(#h${id})`} />
        <rect width="40" height="46" fill={`url(#v${id})`} />
        <path d={SEAMS} stroke="#000" strokeOpacity="0.18" strokeWidth="0.6" fill="none" />
        <path d={CUFFS} fill={kit.trim} />
        {/* the inner half of a light edge: shapes a dark shirt on a dark page */}
        <path d={SHIRT} fill="none" stroke="#fff" strokeOpacity={luminance(kit.body) < 0.03 ? 0.4 : 0.22} strokeWidth="1.1" />
      </g>
      <path d={COLLAR} fill={kit.trim} />
      <path d={SHIRT} fill="none" stroke="#000" strokeOpacity="0.32" strokeWidth="0.6" strokeLinejoin="round" />
    </>
  );
}

function Monogram({ text, x, y, size, fill }: { text: string; x: number; y: number; size: number; fill: string }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontFamily="Barlow Condensed, sans-serif"
      fontWeight="700"
      fontSize={size}
      letterSpacing="0.3"
      fill={fill}
    >
      {text}
    </text>
  );
}

function Roundel({ kit, id, name, px }: { kit: Kit; id: string; name: string; px: number }) {
  // the name round the ring and the initials in the middle only where they can be read
  const lettered = px >= 56;
  const r = lettered ? 12.4 : 14.6;
  const ring = deep(kit);
  return (
    <>
      <defs>
        <clipPath id={`c${id}`}>
          <circle cx="20" cy="23" r={r} />
        </clipPath>
        <radialGradient id={`d${id}`} cx="0.32" cy="0.26" r="0.9">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.3" />
        </radialGradient>
        <linearGradient id={`r${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(ring, "#ffffff", 0.16)} />
          <stop offset="1" stopColor={mix(ring, "#000000", 0.25)} />
        </linearGradient>
        <path id={`t${id}`} d="M5.6 23A14.4 14.4 0 0 1 34.4 23" />
      </defs>
      <circle cx="20" cy="23" r="18.6" fill={`url(#r${id})`} />
      <circle cx="20" cy="23" r="17.9" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.5" />
      <g clipPath={`url(#c${id})`}>
        <Pattern kit={kit} />
        <rect width="40" height="46" fill={`url(#d${id})`} />
      </g>
      <circle cx="20" cy="23" r={r} fill="none" stroke={kit.trim === kit.body ? "#ffffff" : mix(kit.trim, "#ffffff", 0.25)} strokeWidth="0.9" />
      {lettered && (
        <>
          <text fontFamily="Barlow Condensed, sans-serif" fontWeight="700" fontSize="3.9" letterSpacing="0.55" fill="#fff" fillOpacity="0.94">
            <textPath href={`#t${id}`} startOffset="50%" textAnchor="middle">
              {name.toLocaleUpperCase("tr")}
            </textPath>
          </text>
          <circle cx="4.8" cy="25.2" r="0.9" fill="#fff" fillOpacity="0.85" />
          <circle cx="35.2" cy="25.2" r="0.9" fill="#fff" fillOpacity="0.85" />
          <path d={STAR} fill="#fff" fillOpacity="0.9" transform="translate(0 32.2)" />
        </>
      )}
      <circle cx="20" cy="23" r="18.6" fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="0.6" />
    </>
  );
}

function Shield({ kit, id, px }: { kit: Kit; id: string; px: number }) {
  const lettered = px >= 44;
  const frame = deep(kit);
  return (
    <>
      <defs>
        <clipPath id={`c${id}`}>
          <path d={SHIELD} />
        </clipPath>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.26" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#c${id})`}>
        <g transform="translate(0 3)">
          <Pattern kit={kit} />
        </g>
        {/* the chief: a band across the top in the frame's colour */}
        <path d="M0 0H40V14.2Q20 11.4 0 14.2Z" fill={frame} />
        <path d="M0 14.2Q20 11.4 40 14.2" fill="none" stroke={kit.trim === kit.body ? "#fff" : kit.trim} strokeWidth="1.1" />
        {lettered ? (
          <Monogram text={kit.abbr} x={20} y={11.6} size={7} fill="#fff" />
        ) : (
          <path d={STAR} fill="#fff" fillOpacity="0.92" transform="translate(0 5.4)" />
        )}
        <rect width="40" height="46" fill={`url(#g${id})`} />
      </g>
      <path d={SHIELD} fill="none" stroke={frame} strokeWidth="2.4" strokeLinejoin="round" />
      <path d={SHIELD} fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.5" strokeLinejoin="round" transform="translate(20 23.4) scale(0.9) translate(-20 -23.4)" />
      <path d={SHIELD} fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="0.5" strokeLinejoin="round" />
    </>
  );
}

function Tile({ kit, id }: { kit: Kit; id: string }) {
  const ink = inkOn(kit.body);
  return (
    <>
      <defs>
        <clipPath id={`c${id}`}>
          <rect x="1.5" y="4.5" width="37" height="37" rx="10" />
        </clipPath>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.2" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#c${id})`}>
        <rect width="40" height="46" fill={kit.body} />
        {/* the kit's colours as a ribbon along the foot */}
        <rect y="33.4" width="40" height="4.2" fill={kit.accent} />
        <rect y="37.6" width="40" height="4" fill={kit.trim === kit.accent ? kit.body : kit.trim} />
        <rect width="40" height="46" fill={`url(#g${id})`} />
      </g>
      <Monogram
        text={kit.abbr}
        x={20}
        y={kit.abbr.length >= 4 ? 26.4 : 27.4}
        size={kit.abbr.length >= 4 ? 11 : kit.abbr.length === 3 ? 14.5 : 17}
        fill={ink}
      />
      <rect x="1.5" y="4.5" width="37" height="37" rx="10" fill="none" stroke="#000" strokeOpacity="0.3" strokeWidth="0.6" />
      <rect x="2.1" y="5.1" width="35.8" height="35.8" rx="9.4" fill="none" stroke="#fff" strokeOpacity="0.2" strokeWidth="0.6" />
    </>
  );
}

/**
 * A club's badge drawn from its kit (lib/kits.ts), for where the real crest can't be shown: the store
 * edition. Same footprint as a crest (px wide, 1.15 px tall), so either fits the same place.
 */
export function ClubBadge({
  name,
  px,
  style,
  label,
  className,
}: {
  name: string;
  px: number;
  style: BadgeStyle;
  label: string;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const kit = kitFor(name);
  return (
    <svg
      viewBox="0 0 40 46"
      width={px}
      height={Math.round(px * 1.15)}
      className={className}
      role="img"
      aria-label={label}
    >
      <title>{name}</title>
      {style === "kit" && <KitBadge kit={kit} id={id} />}
      {style === "roundel" && <Roundel kit={kit} id={id} name={name} px={px} />}
      {style === "shield" && <Shield kit={kit} id={id} px={px} />}
      {style === "tile" && <Tile kit={kit} id={id} />}
    </svg>
  );
}
