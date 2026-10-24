// After `vite build --mode app` (npm run build:app): what the iPhone app ships is the store edition, so
// the real club crests (public/crests) leave the bundle, not just the screen, and /edition.js says store.
import { rmSync, writeFileSync } from "node:fs";

rmSync("dist/crests", { recursive: true, force: true });
writeFileSync("dist/edition.js", 'window.MATCHNIGHT_EDITION = "store";\n');
console.log("app bundle: crests removed, edition store");
