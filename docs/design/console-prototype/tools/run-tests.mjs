// Runs the prototype's regression suites in headless Edge and prints one line per suite.
//
//   node docs/design/console-prototype/tools/run-tests.mjs            all suites
//   node docs/design/console-prototype/tools/run-tests.mjs payments   one suite
//
// Each suite is a script in tools/tests/ that runs after shell.js, so it sees the same global scope as the page, walks screens
// and opens dialogs, and writes its result into a <pre> at the end of the page. This runner writes a temporary copy of
// index.html with the suite's script added, dumps the DOM, and reads that <pre>. It exits 1 if any suite reports an error.
// Set EDGE to the msedge executable if it is not at the default path. Edge runs with its own throwaway profile.
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const edge = process.env.EDGE || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
// name, script, id of the result element
const SUITES = [["main", "main", "testout"], ["payments", "payments", "testout"], ["treasury", "treasury", "testout"], ["leasing", "leasing", "testout"],
  ["syndication", "syndication", "testout"], ["branch", "branch", "testout"], ["walk", "walk", "walk"]];
const want = process.argv.slice(2);
const html = readFileSync(join(root, "index.html"), "utf8");
const anchor = '<script src="js/shell.js"></script>';
if (!html.includes(anchor)) throw new Error("index.html no longer ends with shell.js; update tools/run-tests.mjs");
const unescape = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const profile = mkdtempSync(join(tmpdir(), "fabor-edge-"));
let failed = 0;
for (const [name, script, id] of SUITES.filter(([n]) => !want.length || want.includes(n))) {
  const page = join(root, `.run-${name}.html`);
  writeFileSync(page, '<meta charset="utf-8">' + html.replace(anchor,`${anchor}\n<script src="tools/tests/${script}.js"></script>`));
  try {
    const r = spawnSync(edge, ["--headless", "--disable-gpu", "--allow-file-access-from-files", `--user-data-dir=${profile}`, "--virtual-time-budget=40000", "--dump-dom", pathToFileURL(page).href],
      { encoding: "utf8", timeout: 240000, maxBuffer: 256 * 1024 * 1024 });
    const m = (r.stdout || "").match(new RegExp(`<pre id="${id}">([\\s\\S]*?)</pre>`));
    if (!m) { console.log(`${name.padEnd(12)} NO OUTPUT${r.error ? ` (${r.error.code || r.error.message}; a stuck headless Edge may need stopping by hand)` : ""}`); failed++; continue; }
    const lines = unescape(m[1]).split(/\r?\n/), ok = lines.filter((l) => l.startsWith("ok ")).length;
    const bad = id === "walk" ? (lines.find((l) => l.startsWith("ERR")) || "ERR").replace(/^ERR\s*/, "") : lines[0].trim().replace(/^ERRORS:/, "") === "0" ? "" : lines.slice(0, 6).join("\n    ");
    console.log(`${name.padEnd(12)} ${bad ? "FAIL" : "ok  "} ${id === "walk" ? lines[0] : `${ok} steps`}${bad ? `\n    ${bad}` : ""}`);
    if (bad) failed++;
  } finally { rmSync(page, { force: true }); }
}
try { rmSync(profile, { recursive: true, force: true }); } catch { /* Edge may still hold its profile; the OS temp folder is cleaned later */ }
process.exit(failed ? 1 : 0);
