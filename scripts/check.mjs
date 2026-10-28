import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, "..");
const build = /export const BUILD = "([^"]+)"/.exec(
  fs.readFileSync(path.join(root, "src/config.js"), "utf8"),
)?.[1];
if (!build) throw new Error("Missing release revision");
let failed = false;
for (const file of fs
  .readdirSync(path.join(root, "src"))
  .filter((n) => n.endsWith(".js"))) {
  const full = path.join(root, "src", file),
    result = spawnSync(process.execPath, ["--check", full], {
      encoding: "utf8",
    });
  if (result.status !== 0) {
    failed = true;
    console.error(result.stderr);
  }
  const source = fs.readFileSync(full, "utf8");
  for (const match of source.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)) {
    if (
      !fs.existsSync(path.resolve(path.dirname(full), match[1].split("?")[0]))
    ) {
      failed = true;
      console.error("Missing import:", file, match[1]);
    }
    if (!match[1].endsWith(`?rev=${build}`)) {
      failed = true;
      console.error("Stale module revision:", file, match[1]);
    }
  }
}
const html = fs.readFileSync(path.join(root, "index.html"), "utf8"),
  ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
if (new Set(ids).size !== ids.length) {
  failed = true;
  console.error("Duplicate HTML ids");
}
for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (/^(https?:|data:|\.\/)/.test(match[1])) continue;
  if (match[1].startsWith("src/") && !match[1].endsWith(`?rev=${build}`)) {
    failed = true;
    console.error("Stale entry revision:", match[1]);
  }
  if (!fs.existsSync(path.join(root, match[1].split("?")[0]))) {
    failed = true;
    console.error("Missing page asset:", match[1]);
  }
}
if (/https?:\/\//.test(html.match(/<script[\s\S]*$/)?.[0] || "")) {
  failed = true;
  console.error("Runtime scripts must be local");
}
if (failed) process.exit(1);
console.log(
  "Source syntax, module graph, release revisions, page assets and DOM ids: OK",
);
