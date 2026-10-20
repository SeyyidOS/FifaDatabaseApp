import { useId, type ReactNode } from "react";
import { kitFor, luminance, type Kit } from "../../lib/kits";

// the shirt, drawn on a 40 x 46 grid (a crest's proportions)
const SHIRT =
  "M14.5 5C16 7.2 17.8 8.4 20 8.4S24 7.2 25.5 5L33.2 7.6Q35 8.3 35.9 9.9L39 16.6 34.6 20.4 31.4 17.8V41.2Q20 43.4 8.6 41.2V17.8L5.4 20.4 1 16.6 4.1 9.9Q5 8.3 6.8 7.6Z";
const SLEEVES =
  "M9.6 6.4 6.8 7.6Q5 8.3 4.1 9.9L1 16.6 5.4 20.4 8.6 17.8ZM30.4 6.4 33.2 7.6Q35 8.3 35.9 9.9L39 16.6 34.6 20.4 31.4 17.8Z";
const CUFFS = "M1 16.6 5.4 20.4 6.4 19.2 2 15.4ZM39 16.6 34.6 20.4 33.6 19.2 38 15.4Z";
const COLLAR = "M14.5 5C16 7.2 17.8 8.4 20 8.4S24 7.2 25.5 5L23.7 4.5C22.7 6 21.5 6.7 20 6.7S17.3 6 16.3 4.5Z";
const NECK = "M16.3 4.5C17.3 6 18.5 6.7 20 6.7S22.7 6 23.7 4.5Q20 3.3 16.3 4.5Z";
const SEAMS = "M9.6 6.4 8.6 17.8M30.4 6.4 31.4 17.8";

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** `hex` darkened by t (0..1) */
function darken(hex: string, t: number): string {
  const v = hex.replace("#", "");
  return `#${[0, 2, 4]
    .map((i) => Math.round(parseInt(v.slice(i, i + 2), 16) * (1 - t)).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** The kit's pattern over the whole grid; the shirt clips it. */
function Pattern({ kit }: { kit: Kit }) {
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
        .map((k) => <rect key={k} y={3 + k * 4.2} width="40" height="4.2" fill={accent} />);
      break;
    case "halves":
      over = <rect x="20" width="20" height="46" fill={accent} />;
      break;
    case "sleeves":
      over = <path d={SLEEVES} fill={accent} />;
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
      over = <path d="M11 2.5 18 2.5 36 46 27 46Z" fill={accent} />;
      break;
    case "chest":
      over = <rect y="15.5" width="40" height="6" fill={accent} />;
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

/**
 * A club's home shirt (lib/kits.ts), drawn where its crest can't be shown: the store edition, or a club
 * without one. Same footprint as a crest (px wide, 1.15 px tall), so either fits the same place.
 */
export function ClubKit({ name, px, label, className }: { name: string; px: number; label: string; className?: string }) {
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
      <defs>
        <clipPath id={`c${id}`}>
          <path d={SHIRT} />
        </clipPath>
        {/* light from above */}
        <linearGradient id={`v${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.24" />
          <stop offset="0.42" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.2" />
        </linearGradient>
        {/* the body rounding away at the sides */}
        <linearGradient id={`h${id}`} x1="8.6" x2="31.4" y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#000" stopOpacity="0.22" />
          <stop offset="0.24" stopColor="#000" stopOpacity="0" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.26" />
        </linearGradient>
      </defs>
      <path d={NECK} fill={darken(kit.body, 0.45)} />
      <g clipPath={`url(#c${id})`}>
        <Pattern kit={kit} />
        <path d={SLEEVES} fill="#000" opacity="0.1" />
        <rect width="40" height="46" fill={`url(#h${id})`} />
        <rect width="40" height="46" fill={`url(#v${id})`} />
        <path d={SEAMS} stroke="#000" strokeOpacity="0.18" strokeWidth="0.6" fill="none" />
        <path d={CUFFS} fill={kit.trim} />
        {/* the inner half of a light edge: shapes a dark shirt on a dark page */}
        <path
          d={SHIRT}
          fill="none"
          stroke="#fff"
          strokeOpacity={luminance(kit.body) < 0.03 ? 0.4 : 0.22}
          strokeWidth="1.1"
        />
      </g>
      <path d={COLLAR} fill={kit.trim} />
      <path d={SHIRT} fill="none" stroke="#000" strokeOpacity="0.32" strokeWidth="0.6" strokeLinejoin="round" />
    </svg>
  );
}
