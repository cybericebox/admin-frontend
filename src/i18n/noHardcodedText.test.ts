// @vitest-environment node
/**
 * Regression guard for the i18n rule: user-facing text lives in messages/*.json
 * and reaches the UI through t(). Any Cyrillic in a string literal, template
 * literal or JSX text under src/ (outside tests) is hardcoded UI text.
 * Comments are ignored because only AST literal nodes are inspected.
 */
import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

const SRC = path.resolve(import.meta.dirname, "..")
const CYRILLIC = /[Ѐ-ӿ]/

// Files allowed to keep Cyrillic literals, each with the reason.
const ALLOWLIST: Record<string, string> = {}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === "test" ? [] : sourceFiles(p)
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !e.name.endsWith(".d.ts") ? [p] : []
  })
}

function cyrillicLiterals(file: string): string[] {
  const sf = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const hits: string[] = []
  const visit = (node: ts.Node) => {
    const text = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateLiteralToken(node) ? node.text : ts.isJsxText(node) ? node.text : null
    if (text && CYRILLIC.test(text)) hits.push(`${path.relative(SRC, file)}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${JSON.stringify(text.trim())}`)
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return hits
}

describe("no hardcoded UI text", () => {
  it("has no Cyrillic string literals or JSX text outside messages/", () => {
    const hits = sourceFiles(SRC).filter((f) => !(path.relative(SRC, f) in ALLOWLIST)).flatMap(cyrillicLiterals)
    expect(hits).toEqual([])
  })

  it("allowlist entries exist and carry a reason", () => {
    for (const [file, reason] of Object.entries(ALLOWLIST)) {
      expect(fs.existsSync(path.join(SRC, file)), `${file} no longer exists`).toBe(true)
      expect(reason.trim(), `${file} needs a reason`).not.toBe("")
    }
  })
})
