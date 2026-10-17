import { useId } from "react";

/**
 * Matchnight's mark: a floodlit corner of the pitch (mown grass, the corner arc, a lime flag). The same
 * drawing is in public/icon.svg (the favicon, as `small`) and the home-screen PNGs. `small` is for 32px
 * and under: no stripes and thicker lines, so it still reads in a browser tab.
 */
export function BrandMark({ className, small }: { className?: string; small?: boolean }) {
  // gradient ids must be unique on the page; useId's own characters aren't safe inside url(#…)
  const id = `bm${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const line = small ? 7 : 4.6;
  const top = small ? 18 : 15;
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a5c33" />
          <stop offset="1" stopColor="#0a2c18" />
        </linearGradient>
        <pattern id={`${id}s`} width="25" height="100" patternUnits="userSpaceOnUse">
          <rect width="12.5" height="100" fill="#fff" fillOpacity="0.05" />
        </pattern>
        <radialGradient id={`${id}l`} cx="0.5" cy="-0.08" r="0.9">
          <stop offset="0" stopColor="#f2ffd9" stopOpacity="0.26" />
          <stop offset="0.62" stopColor="#f2ffd9" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}v`} cx="0.5" cy="0.42" r="0.78">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.5" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${id}g)`} />
      {!small && <rect width="100" height="100" fill={`url(#${id}s)`} />}
      <rect width="100" height="100" fill={`url(#${id}l)`} />
      <rect width="100" height="100" fill={`url(#${id}v)`} />
      {!small && <path d="M30 60H100V100H30Z" fill="#fff" fillOpacity="0.035" />}
      <g fill="none" stroke="#f2f6ee" strokeWidth={line} strokeLinecap="round">
        <path d="M30 60H104M30 60V104" />
        <path d="M44 60A14 14 0 0 1 30 74" />
        <path d={`M30 61V${top}`} />
      </g>
      <path d={`M32 ${top}L66 ${top + 11}L32 ${top + 22}Z`} fill="#c8ff3d" />
    </svg>
  );
}
