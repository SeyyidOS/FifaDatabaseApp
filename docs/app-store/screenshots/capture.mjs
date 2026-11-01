// App Store screenshots (docs/app-store/screenshots/README.md): 6.9" iPhone, 1320x2868, TR and EN, from the
// store build against a scratch API seeded by deploy/review-league.py. Runs in mcr.microsoft.com/playwright:v1.57.0-noble
// on the scratch network (mn-scratch-api, mn-scratch-app), with playwright@1.57.0 installed next to it.
import { webkit } from "playwright";
const API = "http://mn-scratch-api:8080";
const APP = "http://mn-scratch-app:8080";
const post = async (path, body, token) =>
  (await fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json", "X-Edition": "store", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body ?? {}) })).json();
await post("/auth/email", { email: "demo@example.com", lang: "en" });
const account = await post("/auth/email/code", { email: "demo@example.com", code: "314159" });
// as App Review does on first sign-in (TermsGate); an API without terms just answers 404
await post("/auth/me/terms", null, account.token);
const slug = "friday-night-league";
const board = await post(`/boards/${slug}/session`, null, account.token);
const players = await (await fetch(`${API}/boards/${slug}/players`, { headers: { Authorization: `Bearer ${board.token}` } })).json();
// a player without an account (Sam has one, for Block: deploy/review-league.py)
const jordan = players.find((p) => p.name === "jordan");
const invite = await post(`/boards/${slug}/invites`, { playerId: jordan.id }, account.token);

const b = await webkit.launch();
const problems = [];
for (const [lang, locale] of [["tr", "tr-TR"], ["en", "en-US"]]) {
  const shots = [
    ["1-home", `/#/b/${slug}`],
    ["2-profile", "/#/"],
    ["3-match", `/#/b/${slug}/play`],
    ["4-table", `/#/b/${slug}/leaderboard`],
    ["5-night", `/#/b/${slug}/night`],
    ["6-invite", `/#/join/${invite.code}`],
  ];
  for (const [name, path] of shots) {
    const ctx = await b.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale });
    await ctx.addInitScript(([acc, signedIn]) => {
      if (signedIn) localStorage.setItem("fm-account", JSON.stringify(acc));
      let seed = 7;
      Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    }, [{ token: account.token, user: { ...account.user, name: "Alex", termsAccepted: true } }, name !== "6-invite"]);
    const p = await ctx.newPage();
    await p.goto(APP + path);
    await p.waitForTimeout(3500);
    // headless WebKit now and then leaves an entrance animation at opacity 0: load again until none on screen
    // is (further down, they wait for a scroll that never comes)
    const hidden = () =>
      p.evaluate(() =>
        [...document.querySelectorAll("body *")].filter((e) => {
          const r = e.getBoundingClientRect();
          return getComputedStyle(e).opacity === "0" && r.height > 40 && r.top < innerHeight && r.bottom > 0;
        }).length,
      );
    for (let i = 0; i < 4 && (await hidden()) > 0; i++) {
      await p.reload();
      await p.waitForTimeout(3500);
    }
    if ((await hidden()) > 0) problems.push(`${lang}/${name}: blocks still hidden`);
    if (name === "3-match") {
      await p.getByRole("button", { name: /Takımları karıştır|Shuffle/i }).first().click();
      await p.waitForTimeout(500);
      await p.getByRole("button", { name: /Dengeli rastgele kulüpler|Balanced random clubs/i }).first().click();
      await p.waitForTimeout(4500);
    }
    // the independence note (EditionNotes) names EA SPORTS and FIFA on purpose
    const text = await p.evaluate(() => {
      const body = document.body.cloneNode(true);
      body.querySelectorAll("p").forEach((e) => /EA SPORTS/.test(e.textContent) && e.remove());
      return body.textContent;
    });
    const crests = await p.locator('img[src*="crests"]').count();
    if (/FC ?2\d|fut\.gg|FIFA/i.test(text) || crests) problems.push(`${lang}/${name}: ${crests} crests, text ${text.match(/FC ?2\d|fut\.gg|FIFA/i)?.[0] ?? "-"}`);
    await p.screenshot({ path: `/out/${lang}-${name}.png` });
    await ctx.close();
  }
}
await b.close();
console.log(problems.length ? "PROBLEMS:\n" + problems.join("\n") : "no crests, no FC27, no fut.gg, no FIFA on any screen");
