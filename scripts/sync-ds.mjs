#!/usr/bin/env node
// Copies the design-system files this app uses from docs/design-system (the source of truth) into src/styles/ds
// and public, and records their hashes in src/styles/ds/ds.lock.json. Copied, never imported.
//   node scripts/sync-ds.mjs            copy and rewrite the lock
//   node scripts/sync-ds.mjs --check    compare the copies with the design system (when the monorepo is next to this repo)
// The CI test (src/styles/ds/ds.test.ts) compares the copies with the lock, so a hand edit of a copy fails the build.
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
// docs/design-system sits in the monorepo around this repo (also when this is a worktree); DS_DIR overrides.
function findSource() {
  for (let dir = root; dir !== path.dirname(dir); dir = path.dirname(dir)) {
    const candidate = path.join(dir, "docs/design-system")
    if (fs.existsSync(candidate)) return candidate
  }
  return path.resolve(root, "../docs/design-system")
}
const source = process.env.DS_DIR ?? findSource()
// from (relative to the design system) -> to (relative to this repo). transform runs on the text before it is written.
const FILES = [
  { from: "tokens.css", to: "src/styles/ds/tokens.css", transform: dropFontFace },
  { from: "patterns/admin-sidebar/admin-sidebar.css", to: "src/styles/ds/admin-sidebar.css" },
  { from: "components/chart-theme/chart-theme.js", to: "src/styles/ds/chart-theme.js" },
  { from: "components/chart-theme/chart-theme.d.ts", to: "src/styles/ds/chart-theme.d.ts" },
  { from: "assets/crest-64.png", to: "public/crest-64.png" },
  { from: "assets/crest-128.png", to: "public/crest-128.png" },
]
const lockFile = path.join(root, "src/styles/ds/ds.lock.json")

// The app loads Geist through next/font (public/assets/fonts is not served from the design system folder).
function dropFontFace(text) {
  return text.split("\n").filter((line) => !line.startsWith("@font-face")).join("\n")
}
const hash = (buf) => createHash("sha256").update(buf).digest("hex")
const render = (file) => {
  const buf = fs.readFileSync(path.join(source, file.from))
  return file.transform ? Buffer.from(file.transform(buf.toString("utf8"))) : buf
}

if (process.argv.includes("--check")) {
  if (!fs.existsSync(source)) { console.log(`design system not found at ${source}, skipped`); process.exit(0) }
  const stale = FILES.filter((file) => hash(render(file)) !== hash(fs.readFileSync(path.join(root, file.to))))
  if (stale.length) { console.error(`out of date with the design system, run node scripts/sync-ds.mjs: ${stale.map((f) => f.to).join(", ")}`); process.exit(1) }
  console.log("design system copies are current")
} else {
  const lock = {}
  for (const file of FILES) {
    const out = render(file)
    fs.mkdirSync(path.dirname(path.join(root, file.to)), { recursive: true })
    fs.writeFileSync(path.join(root, file.to), out)
    lock[file.to] = hash(out)
  }
  fs.writeFileSync(lockFile, JSON.stringify(lock, null, 2) + "\n")
  console.log(`copied ${FILES.length} files`)
}
