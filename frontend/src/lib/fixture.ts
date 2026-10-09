/**
 * A night's 2v2 schedule (port of the fc27-elo study's fixture tool).
 *
 * A greedy pass builds the night match by match from the players who have played least and rested
 * longest; the best attempts are then polished by local search (re-splitting a match's four, swapping
 * players between matches). Breaking a rule costs far more than anything else, then repeated
 * partnerships and opponents are spread out; Elo balance is optional.
 */

export type Variety = "off" | "normal" | "strong";

export interface FixtureRules {
  /** every player plays at least this many matches */
  minPer: number;
  /** at most this many matches in a row */
  maxStreak: number;
  /** the same two players side by side at most this many matches in a row */
  maxPartner: number;
  /** the same two players side by side at most this many times in all (0: no limit) */
  partnerCap: number;
  variety: Variety;
  /** also even out the sides' average Elo */
  balance: boolean;
}

export const DEFAULT_RULES: FixtureRules = { minPer: 3, maxStreak: 2, maxPartner: 1, partnerCap: 0, variety: "normal", balance: false };

export interface PlannedMatch {
  a: [string, string];
  b: [string, string];
  /** rules this match breaks (only when they can't all hold) */
  violations: number;
}

export interface Fixture {
  matches: PlannedMatch[];
  violations: number;
  /** difference between the most and fewest matches anyone plays */
  spread: number;
  /** summed difference of the sides' average Elo */
  eloGap: number;
}

/** Cost of meeting the same pair again (and, at 40%, the same opponent). */
const VARIETY: Record<Variety, number> = { off: 0, normal: 8, strong: 25 };

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

type Side = [string, string];
interface Draft {
  A: Side;
  B: Side;
  v: number;
}

export function generateFixture(
  players: string[],
  rules: FixtureRules,
  eloOf: (name: string) => number,
  random: () => number = Math.random,
): Fixture | null {
  const ids = [...players];
  const o = rules;
  const VW = VARIETY[o.variety] ?? VARIETY.normal;
  const P = ids.length;
  if (P < 4) return null;
  const maxMatches = Math.ceil((P * o.minPer) / 4) + P + 4;
  const shuffle = <T>(a: T[]) => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const combos4 = (arr: string[]) => {
    const out: string[][] = [];
    for (let a = 0; a < arr.length; a++)
      for (let b = a + 1; b < arr.length; b++)
        for (let c = b + 1; c < arr.length; c++) for (let d = c + 1; d < arr.length; d++) out.push([arr[a], arr[b], arr[c], arr[d]]);
    return out;
  };
  const avg = (s: Side) => (eloOf(s[0]) + eloOf(s[1])) / 2;
  const splits = ([w, x, y, z]: string[]): [Side, Side][] => [
    [[w, x], [y, z]],
    [[w, y], [x, z]],
    [[w, z], [x, y]],
  ];

  /** Scores a whole night: rule breaks (per match), squared repeats of pairs and opponents, Elo gaps. */
  function evaluate(list: Draft[]) {
    const streak: Record<string, number> = {};
    const lastP: Record<string, string> = {};
    const pStreak: Record<string, number> = {};
    const pc: Record<string, number> = {};
    const oc: Record<string, number> = {};
    let viol = 0;
    let diff = 0;
    const per = list.map((mm) => {
      let v = 0;
      const inM = new Set([...mm.A, ...mm.B]);
      ids.forEach((p) => {
        streak[p] = inM.has(p) ? (streak[p] || 0) + 1 : 0;
        if (streak[p] > o.maxStreak) v++;
      });
      [mm.A, mm.B].forEach(([p, q]) => {
        const k = pairKey(p, q);
        pc[k] = (pc[k] || 0) + 1;
        if (o.partnerCap > 0 && pc[k] > o.partnerCap) v++;
        [
          [p, q],
          [q, p],
        ].forEach(([a, b]) => {
          pStreak[a] = lastP[a] === b ? pStreak[a] + 1 : 1;
          lastP[a] = b;
        });
        if (pStreak[p] > o.maxPartner) v++;
      });
      mm.A.forEach((p) => mm.B.forEach((q) => (oc[pairKey(p, q)] = (oc[pairKey(p, q)] || 0) + 1)));
      diff += Math.abs(avg(mm.A) - avg(mm.B));
      viol += v;
      return v;
    });
    const sq = (m: Record<string, number>) => Object.values(m).reduce((t, c) => t + c * c, 0);
    const rep2 = sq(pc);
    const opp2 = sq(oc);
    return { per, viol, diff, obj: viol * 1000 + (o.balance ? diff / 40 : 0) + (VW * (rep2 + 0.5 * opp2)) / 2 };
  }

  /** Local search: better splits of each match's four, then swaps between two matches. */
  function polish(list: Draft[]) {
    let cur = list.map((mm) => ({ A: [...mm.A] as Side, B: [...mm.B] as Side, v: mm.v }));
    let best = evaluate(cur);
    const tryList = (trial: Draft[]) => {
      const e = evaluate(trial);
      if (e.obj < best.obj - 1e-9) {
        cur = trial;
        best = e;
        return true;
      }
      return false;
    };
    for (let pass = 0; pass < 30; pass++) {
      let improved = false;
      for (let i = 0; i < cur.length; i++) {
        for (const [A, B] of splits([...cur[i].A, ...cur[i].B])) {
          const trial = cur.slice();
          trial[i] = { A, B, v: 0 };
          if (tryList(trial)) improved = true;
        }
      }
      for (let i = 0; i < cur.length; i++)
        for (let j = i + 1; j < cur.length; j++) {
          const inI = [...cur[i].A, ...cur[i].B];
          const inJ = new Set([...cur[j].A, ...cur[j].B]);
          for (const pX of inI) {
            if (inJ.has(pX)) continue;
            for (const pY of inJ) {
              if (inI.includes(pY)) continue;
              const sw = (side: Side) => side.map((p) => (p === pX ? pY : p === pY ? pX : p)) as Side;
              const trial = cur.slice();
              trial[i] = { A: sw(cur[i].A), B: sw(cur[i].B), v: 0 };
              trial[j] = { A: sw(cur[j].A), B: sw(cur[j].B), v: 0 };
              if (tryList(trial)) {
                improved = true;
                break;
              }
            }
          }
        }
      if (!improved) break;
    }
    return { matches: cur.map((mm, i) => ({ ...mm, v: best.per[i] })), ...best };
  }

  function attempt(relaxed: boolean) {
    const cnt: Record<string, number> = {};
    const streak: Record<string, number> = {};
    const lastP: Record<string, string> = {};
    const pStreak: Record<string, number> = {};
    const last: Record<string, number> = {};
    const pc: Record<string, number> = {};
    const oc: Record<string, number> = {};
    const seen = new Set<string>();
    const out: Draft[] = [];
    const pcOf = (a: string, b: string) => pc[pairKey(a, b)] || 0;
    const ocOf = (a: string, b: string) => oc[pairKey(a, b)] || 0;
    ids.forEach((i) => {
      cnt[i] = 0;
      streak[i] = 0;
      last[i] = -1;
    });
    for (let m = 0; m < maxMatches && ids.some((i) => cnt[i] < o.minPer); m++) {
      const order = shuffle(ids).sort((a, b) => cnt[a] - cnt[b] || last[a] - last[b]);
      const pool = order.slice(0, Math.min(order.length, 10));
      let best: (Draft & { key: string; cost: number }) | null = null;
      for (const four of combos4(pool)) {
        for (const [A, B] of splits(four)) {
          let v = 0;
          four.forEach((p) => {
            if (streak[p] >= o.maxStreak) v++;
          });
          [A, B].forEach(([p, q]) => {
            if (lastP[p] === q && pStreak[p] >= o.maxPartner) v++;
            if (lastP[q] === p && pStreak[q] >= o.maxPartner) v++;
            if (o.partnerCap > 0 && pcOf(p, q) >= o.partnerCap) v++;
          });
          if (v && !relaxed) continue;
          const key = [A.slice().sort().join("+"), B.slice().sort().join("+")].sort().join(" vs ");
          const variety =
            VW * (pcOf(A[0], A[1]) + pcOf(B[0], B[1])) +
            VW * 0.4 * (ocOf(A[0], B[0]) + ocOf(A[0], B[1]) + ocOf(A[1], B[0]) + ocOf(A[1], B[1]));
          const cost =
            v * 1000 +
            four.reduce((t, p) => t + cnt[p], 0) * 10 +
            (o.balance ? Math.abs(avg(A) - avg(B)) / 40 : 0) +
            variety +
            (seen.has(key) ? 6 : 0) +
            random();
          if (!best || cost < best.cost) best = { A, B, v, key, cost };
        }
      }
      if (!best) return null;
      seen.add(best.key);
      [best.A, best.B].forEach(([p, q]) => (pc[pairKey(p, q)] = (pc[pairKey(p, q)] || 0) + 1));
      best.A.forEach((p) => best!.B.forEach((q) => (oc[pairKey(p, q)] = (oc[pairKey(p, q)] || 0) + 1)));
      const inM = new Set([...best.A, ...best.B]);
      ids.forEach((p) => (streak[p] = inM.has(p) ? streak[p] + 1 : 0));
      [best.A, best.B].forEach(([p, q]) =>
        [
          [p, q],
          [q, p],
        ].forEach(([a, b]) => {
          pStreak[a] = lastP[a] === b ? pStreak[a] + 1 : 1;
          lastP[a] = b;
        }),
      );
      inM.forEach((p) => {
        cnt[p]++;
        last[p] = m;
      });
      out.push({ A: best.A, B: best.B, v: best.v });
    }
    if (ids.some((i) => cnt[i] < o.minPer)) return null;
    const counts = Object.values(cnt);
    const e = evaluate(out);
    return {
      matches: out.map((mm, i) => ({ ...mm, v: e.per[i] })),
      viol: e.viol,
      spread: Math.max(...counts) - Math.min(...counts),
      diff: e.diff,
      score: e.obj,
    };
  }

  type Attempt = NonNullable<ReturnType<typeof attempt>>;
  const better = (a: Attempt, b: Attempt | null) =>
    !b ||
    a.viol < b.viol ||
    (a.viol === b.viol &&
      (a.matches.length < b.matches.length ||
        (a.matches.length === b.matches.length && (a.spread < b.spread || (a.spread === b.spread && a.score < b.score)))));
  const finish = (r: Attempt): Attempt => {
    const pol = polish(r.matches);
    return { ...r, matches: pol.matches, viol: pol.viol, diff: pol.diff, score: pol.obj };
  };
  const run = (relaxed: boolean) => {
    const pool: Attempt[] = [];
    for (let t = 0; t < 120; t++) {
      const r = attempt(relaxed);
      if (r) pool.push(r);
    }
    pool.sort((x, y) => (better(x, y) ? -1 : better(y, x) ? 1 : 0));
    let best: Attempt | null = null;
    pool.slice(0, 8).map(finish).forEach((r) => {
      if (better(r, best)) best = r;
    });
    return best as Attempt | null;
  };
  const best = run(false) ?? run(true);
  if (!best) return null;
  return {
    matches: best.matches.map((mm) => ({ a: mm.A, b: mm.B, violations: mm.v })),
    violations: best.viol,
    spread: best.spread,
    eloGap: best.diff,
  };
}

export type StreakAdvice =
  | { kind: "impossible"; need: number; fair: number }
  | { kind: "everyone" }
  | { kind: "same-rest"; next: number }
  | null;

/**
 * Each match rests P − 4 players, and everyone must rest within S + 1 matches. With too few rests
 * "at most S in a row" can't hold; with exactly enough, the same players always rest together and
 * keep meeting each other.
 */
export function streakAdvice(P: number, S: number): StreakAdvice {
  if (P < 4) return null;
  if (P === 4) return { kind: "everyone" };
  const rests = (P - 4) * (S + 1);
  let need = S;
  while ((P - 4) * (need + 1) < P) need++;
  let fair = need;
  while ((P - 4) * (fair + 1) <= P) fair++;
  if (rests < P) return { kind: "impossible", need, fair };
  if (rests === P) return { kind: "same-rest", next: S + 1 };
  return null;
}

/** How often each pair plays side by side and against each other. */
export function pairCounts(matches: { a: string[]; b: string[] }[]) {
  const together = new Map<string, number>();
  const against = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const mm of matches) {
    for (const side of [mm.a, mm.b]) if (side.length === 2) bump(together, pairKey(side[0], side[1]));
    mm.a.forEach((p) => mm.b.forEach((q) => bump(against, pairKey(p, q))));
  }
  return { together, against, key: pairKey };
}
