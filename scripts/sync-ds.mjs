#!/usr/bin/env node
// Copies the design-system files this app uses from docs/design-system (the source of truth) into src/styles/ds
// and public, and records their sha256 in src/styles/ds/manifest.json. Copied, never imported.
//   node scripts/sync-ds.mjs            copy and rewrite the lock
//   node scripts/sync-ds.mjs --check    exit 1 on drift (manifest hashes, and the design system itself when it is reachable)
// CI runs `npm run check:ds`; src/styles/ds/ds.test.ts checks the same manifest in the unit tests.
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
  { from: "components/tooltip/tooltip.css", to: "src/styles/ds/tooltip.css" },
  { from: "components/tabs/tabs.css", to: "src/styles/ds/tabs.css" },
  { from: "components/segmented/segmented.css", to: "src/styles/ds/segmented.css" },
  { from: "components/tag/tag.css", to: "src/styles/ds/tag.css" },
  { from: "components/table/table.css", to: "src/styles/ds/table.css" },
  { from: "components/empty-state/empty-state.css", to: "src/styles/ds/empty-state.css" },
  { from: "components/pagination/pagination.css", to: "src/styles/ds/pagination.css" },
  { from: "patterns/page-header/page-header.css", to: "src/styles/ds/page-header.css" },
  { from: "components/chart-theme/chart-theme.js", to: "src/styles/ds/chart-theme.js" },
  { from: "components/chart-theme/chart-theme.d.ts", to: "src/styles/ds/chart-theme.d.ts" },
  { from: "assets/crest-64.png", to: "public/crest-64.png" },
  { from: "assets/crest-128.png", to: "public/crest-128.png" },
]
const manifestFile = path.join(root, "src/styles/ds/manifest.json")

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
  // 1. always: every copy still has the hash recorded in manifest.json (no hand edits, no half-synced files)
  // 2. when the design system is reachable: every copy equals what the sync would write from it
  const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")) : {}
  const hasSource = fs.existsSync(source)
  let drift = 0
  for (const file of FILES) {
    const target = path.join(root, file.to)
    const current = fs.existsSync(target) ? hash(fs.readFileSync(target)) : ""
    if (current !== manifest[file.to]) { console.error(`ds drift: ${file.to} does not match manifest.json (edited by hand or not synced)`); drift++ }
    if (hasSource && current !== hash(render(file))) { console.error(`ds drift: ${file.to} differs from docs/design-system/${file.from}`); drift++ }
  }
  if (!hasSource) console.log("ds check: design system source not found, manifest check only")
  if (drift) { console.error("run: node scripts/sync-ds.mjs and commit the result"); process.exit(1) }
} else {
  if (!fs.existsSync(source)) { console.error("design system source not found (set DS_DIR)"); process.exit(1) }
  const manifest = {}
  for (const file of FILES) {
    const out = render(file)
    fs.mkdirSync(path.dirname(path.join(root, file.to)), { recursive: true })
    fs.writeFileSync(path.join(root, file.to), out)
    manifest[file.to] = hash(out)
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n")
  console.log(`copied ${FILES.length} files`)
}
