import { useId, useState } from "react";
import { cn } from "../../lib/cn";
import { displayName } from "../../lib/format";
import { crestFor } from "../../lib/crests";
import { clubIdentity, initials, playerGradient } from "../../lib/identity";

const AVATAR_SIZES = {
  xs: "size-5 text-[10px]",
  sm: "size-7 text-xs",
  md: "size-9 text-sm",
  lg: "size-12 text-lg",
  xl: "size-20 text-3xl",
  "2xl": "size-28 text-5xl",
} as const;

const RINGS = {
  a: "ring-2 ring-team-a ring-offset-2 ring-offset-surface",
  b: "ring-2 ring-team-b ring-offset-2 ring-offset-surface",
  accent: "ring-2 ring-accent ring-offset-2 ring-offset-surface",
} as const;

export function Avatar({
  name,
  size = "md",
  ring,
  className,
}: {
  name: string;
  size?: keyof typeof AVATAR_SIZES;
  ring?: keyof typeof RINGS;
  className?: string;
}) {
  const [c1, c2] = playerGradient(name);
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-grid shrink-0 place-items-center rounded-full font-display font-bold text-white select-none",
        "shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_4px_14px_-6px_rgba(0,0,0,.6)]",
        AVATAR_SIZES[size],
        ring && RINGS[ring],
        className,
      )}
      style={{ background: `linear-gradient(140deg, ${c1}, ${c2})` }}
    >
      <span className="translate-y-[0.03em] drop-shadow-[0_1px_1px_rgba(0,0,0,.35)]">
        {initials(displayName(name))}
      </span>
    </span>
  );
}

const CREST_SIZES = { xs: 18, sm: 24, md: 32, lg: 44, xl: 64, "2xl": 88 } as const;

export function ClubCrest({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof CREST_SIZES;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const [broken, setBroken] = useState<string | null>(null);
  const { abbr, primary, secondary, ink } = clubIdentity(name);
  const px = CREST_SIZES[size];
  const crest = crestFor(name);

  if (crest && broken !== crest.src) {
    return (
      <img
        src={crest.src}
        alt={`${name} crest`}
        title={name}
        width={px}
        height={Math.round(px * 1.15)}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setBroken(crest.src)}
        className={cn(
          "shrink-0 object-contain select-none drop-shadow-[0_3px_8px_rgba(0,0,0,.35)]",
          crest.mono && "dark:brightness-0 dark:invert",
          className,
        )}
        style={{ width: px, height: Math.round(px * 1.15) }}
      />
    );
  }
  const fontSize = abbr.length >= 3 ? 12 : 14;
  return (
    <svg
      viewBox="0 0 40 46"
      width={px}
      height={px * 1.15}
      className={cn("shrink-0 drop-shadow-[0_4px_10px_rgba(0,0,0,.35)]", className)}
      role="img"
      aria-label={`${name} crest`}
    >
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={primary} />
          <stop offset="1" stopColor={primary} stopOpacity="0.78" />
        </linearGradient>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`c${id}`}>
          <path d="M20 1.5 37.5 6.5V22c0 11.6-7.6 18.6-17.5 22.5C10.1 40.6 2.5 33.6 2.5 22V6.5Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#c${id})`}>
        <rect width="40" height="46" fill={`url(#g${id})`} />
        <path d="M0 4 20 -1 40 4V12L20 7 0 12Z" fill={secondary} opacity="0.95" />
        <rect width="40" height="46" fill={`url(#s${id})`} />
      </g>
      <path
        d="M20 1.5 37.5 6.5V22c0 11.6-7.6 18.6-17.5 22.5C10.1 40.6 2.5 33.6 2.5 22V6.5Z"
        fill="none"
        stroke="rgba(255,255,255,.22)"
        strokeWidth="1"
      />
      <text
        x="20"
        y="29"
        textAnchor="middle"
        fontFamily="Barlow Condensed, sans-serif"
        fontWeight="700"
        fontSize={fontSize}
        letterSpacing="0.5"
        fill={ink}
      >
        {abbr}
      </text>
    </svg>
  );
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn("relative inline-block text-[11px] leading-none tracking-[1px]", className)}
      aria-label={`${value} stars`}
      title={`${value} ★`}
    >
      <span className="text-line-strong">★★★★★</span>
      <span
        className="absolute inset-y-0 left-0 overflow-hidden text-gold whitespace-nowrap"
        style={{ width: `${(value / 5) * 100}%` }}
      >
        ★★★★★
      </span>
    </span>
  );
}
