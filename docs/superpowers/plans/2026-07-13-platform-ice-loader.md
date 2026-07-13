# Platform Ice-Cube Loader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain lucide `Spinner` with a branded isometric ice-cube loader (melt→refreeze) across the admin, id, and main CyberICEBox frontends.

**Architecture:** One self-contained component — `spinner.tsx` (exports `Spinner` + `PageLoader`) plus a co-located `spinner.css` (ice-prefixed keyframes + color rules) — built and tested canonically in admin-frontend, then copied **verbatim** into id-frontend and main-frontend (the `COPY-TO-RP-APPS` pattern already used for `src/lib/auth.ts` / `src/i18n/t.ts`). Inline SVG + CSS only; no libraries; no JS/`window` → SSR/static-export safe.

**Tech Stack:** React 19 + TypeScript, Tailwind, `cn` from `@/utils/cn`. Tests: vitest + @testing-library/react (admin only). Spec: `docs/superpowers/specs/2026-07-13-platform-ice-loader-design.md`.

## Global Constraints

- **Three repos, siblings under `/Volumes/Projects/My/CyberICEBox/`:** `admin-frontend` (canonical), `id-frontend`, `main-frontend`. Each has its own git branch/state — commit inside each repo per that repo's convention.
- **admin-frontend commit discipline:** it is on branch `feature/base-redesign` and has FOREIGN uncommitted changes NOT ours (Dockerfile, deploy/*, notifications test/BlockEditor files, untracked `.claude/`). NEVER `git add -A`/`.`/`-u`. Stage ONLY your own paths explicitly, then `git show --stat HEAD` to confirm only your files. If a foreign file leaks, `git reset --soft HEAD~1`, re-stage only your paths, recommit.
- **Canonical = admin.** id-frontend and main-frontend receive the byte-for-byte identical `spinner.tsx` + `spinner.css`. `cn` imports from `@/utils/cn` in all three, so no per-app edits are needed — the files copy verbatim.
- **Superset API (backward-compatible with all existing call sites):** the component exports BOTH:
  - `Spinner({ size?: "sm" | "md" | "lg"; label?: string; className?: string })` — default `size="sm"` (≈20px, matches today's `h-5 w-5`, so existing sites keep their current size). `label` optional.
  - `PageLoader({ label?: string })` — full-screen centered overlay using `<Spinner size="lg">` (id-frontend already imports `PageLoader`; keep it).
- **No external libraries.** Inline SVG + CSS keyframes only. No JS animation, no `window`/`document` access.
- **Keyframes prefixed `ice-`** to avoid collisions; animated SVG nodes use `transform-box: fill-box` so percentage transform-origins pivot correctly.
- **`prefers-reduced-motion: reduce`** → the cube is static and fully frozen (no melt/puddle/shine), still visible.
- **Color:** SVG fill `currentColor`; `.ice-loader` defaults to ice-cyan `#63c1f7` via `color: var(--ice-loader-color, #63c1f7)`; `button .ice-loader { color: currentColor }` so it inherits inside buttons. Both rules ship in `spinner.css` (no host `globals.css` edits).
- **Test infra:** ONLY admin-frontend has vitest + @testing-library/react. id-frontend and main-frontend have neither — do NOT add test tooling to them. Their gate is `npm run build` (Next typecheck + static export) plus existing call sites compiling.
- **Verification (per repo):** admin — scoped `npx eslint <files>` (0 errors; the repo has a pre-existing RED whole-repo lint baseline, so do NOT run `npm run lint`) + `npm run test` + `npm run build`. id/main — `npm run build`.
- **Code comments ENGLISH ONLY** (no Cyrillic).

---

### Task 1: Canonical ice-cube Spinner in admin-frontend (build + test)

**Files:**
- Create: `admin-frontend/src/components/ui/spinner.css`
- Modify (replace contents): `admin-frontend/src/components/ui/spinner.tsx`
- Create: `admin-frontend/src/components/ui/spinner.test.tsx`

**Interfaces:**
- Consumes: `cn` from `@/utils/cn`.
- Produces (verbatim contract for Tasks 2–3):
  - `Spinner({ size?: "sm" | "md" | "lg"; label?: string; className?: string })` — `role="status"` span wrapping a `1em×1em` inline SVG ice cube; `label` → `sr-only`; no `label` → `aria-label="loading"`.
  - `PageLoader({ label?: string })` — fixed-inset centered overlay rendering `<Spinner size="lg" label={label} />`.

- [ ] **Step 1: Write the failing test**

`admin-frontend/src/components/ui/spinner.test.tsx`:

```tsx
/**
 * spinner.test.tsx — the ice-cube Spinner renders an accessible status,
 * honors size, and PageLoader wraps a large one.
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Spinner, PageLoader } from "./spinner"

describe("Spinner", () => {
  it("renders a status role containing an svg", () => {
    const { container } = render(<Spinner />)
    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(container.querySelector("svg")).toBeInTheDocument()
  })

  it("defaults to the sm size class", () => {
    render(<Spinner />)
    expect(screen.getByRole("status").className).toContain("ice-loader-sm")
  })

  it("applies the requested size class", () => {
    render(<Spinner size="lg" />)
    expect(screen.getByRole("status").className).toContain("ice-loader-lg")
  })

  it("exposes label as sr-only text (and no aria-label when labelled)", () => {
    render(<Spinner label="Loading exercises" />)
    const status = screen.getByRole("status")
    expect(status).not.toHaveAttribute("aria-label")
    expect(screen.getByText("Loading exercises")).toHaveClass("sr-only")
  })

  it("falls back to aria-label when no label is given", () => {
    render(<Spinner />)
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "loading")
  })

  it("merges a caller className", () => {
    render(<Spinner className="text-white" />)
    expect(screen.getByRole("status").className).toContain("text-white")
  })
})

describe("PageLoader", () => {
  it("renders a large centered spinner", () => {
    const { container } = render(<PageLoader label="Loading" />)
    expect(screen.getByRole("status").className).toContain("ice-loader-lg")
    expect(container.querySelector(".fixed.inset-0")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd admin-frontend && npx vitest run src/components/ui/spinner.test.tsx`
Expected: FAIL — the new size classes / `PageLoader` export / `label` behavior don't exist yet in the current lucide-based `spinner.tsx` (it exports only `Spinner({className,label})` with a `Loader2`, no `size`, no `PageLoader`, no `ice-loader-*` classes).

- [ ] **Step 3: Write the co-located CSS**

`admin-frontend/src/components/ui/spinner.css`:

```css
/* Ice-cube loader — isometric ICE-Box that melts then refreezes.
   Self-contained: keyframes + color rules travel with the component,
   so no host globals.css changes are needed. All keyframes are ice-* prefixed. */

.ice-loader {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
  /* Ice-cyan by default; inherited (e.g. white) inside buttons via the rule below.
     Override anywhere with --ice-loader-color or a text-color utility. */
  color: var(--ice-loader-color, #63c1f7);
}
.ice-loader svg {
  width: 1em;
  height: 1em;
  overflow: visible;
}
button .ice-loader { color: currentColor; }

/* Size = font-size; the svg is 1em square. */
.ice-loader-sm { font-size: 20px; }
.ice-loader-md { font-size: 32px; }
.ice-loader-lg { font-size: 60px; }

/* Animated faces pivot on their own box. */
.ice-top, .ice-side, .ice-pud, .ice-shine { transform-box: fill-box; }
.ice-top  { transform-origin: 50% 50%;  animation: ice-top  2.2s ease-in-out infinite; }
.ice-side { transform-origin: 50% 100%; animation: ice-side 2.2s ease-in-out infinite; }
.ice-side-r { animation-delay: .04s; }
.ice-pud  { transform-origin: 50% 50%;  animation: ice-pud  2.2s ease-in-out infinite; }
.ice-shine { animation: ice-shine 2.2s ease-in-out infinite; }

@keyframes ice-top {
  0%, 100% { transform: translateY(0) scaleY(1); opacity: 1; }
  45%, 55% { transform: translateY(6px) scaleY(.15); opacity: .35; }
}
@keyframes ice-side {
  0%, 100% { transform: scaleY(1); opacity: 1; }
  45%, 55% { transform: scaleY(.08); opacity: .25; }
}
@keyframes ice-pud {
  0%, 30% { transform: scale(.2); opacity: 0; }
  50%     { transform: scale(1);  opacity: .9; }
  70%, 100% { transform: scale(.2); opacity: 0; }
}
@keyframes ice-shine {
  0%, 100% { opacity: 0; }
  20% { opacity: .85; }
  40% { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .ice-top, .ice-side, .ice-pud, .ice-shine { animation: none; }
  .ice-pud, .ice-shine { opacity: 0; }
}
```

- [ ] **Step 4: Write the component (replace `spinner.tsx` contents)**

`admin-frontend/src/components/ui/spinner.tsx` (replace the whole file):

```tsx
import { cn } from "@/utils/cn"
import "./spinner.css"

const SIZE_CLASS = {
  sm: "ice-loader-sm",
  md: "ice-loader-md",
  lg: "ice-loader-lg",
} as const

// Branded isometric ice-cube loader ("ICE Box"): the cube melts into a puddle
// then refreezes on a loop. Size scales off font-size (svg is 1em square);
// color is currentColor (ice-cyan by default, inherited inside buttons).
// `label` is announced to screen readers; without it a generic aria-label is used.
export function Spinner({
  size = "sm",
  label,
  className,
}: {
  size?: "sm" | "md" | "lg"
  label?: string
  className?: string
}) {
  return (
    <span
      role="status"
      aria-label={label ? undefined : "loading"}
      className={cn("ice-loader", SIZE_CLASS[size], className)}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <ellipse className="ice-pud" cx="12" cy="19" rx="7" ry="1.8" fill="currentColor" />
        <path className="ice-side" d="M4 8 L12 12 L12 20 L4 16 Z" fill="currentColor" opacity=".55" />
        <path className="ice-side ice-side-r" d="M20 8 L12 12 L12 20 L20 16 Z" fill="currentColor" opacity=".8" />
        <path className="ice-top" d="M12 4 L20 8 L12 12 L4 8 Z" fill="currentColor" opacity=".95" />
        <path className="ice-shine" d="M12 5.4 L16.5 7.6 L12 9.9 L7.5 7.6 Z" fill="#fff" opacity="0" />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  )
}

// Full-screen centered loader for page-level loading states.
export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <Spinner size="lg" label={label} />
    </div>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd admin-frontend && npx vitest run src/components/ui/spinner.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 6: Run scoped lint + full suite + build**

Run: `cd admin-frontend && npx eslint src/components/ui/spinner.tsx src/components/ui/spinner.test.tsx`
Expected: 0 errors. (Do NOT run `npm run lint` — the repo has a pre-existing RED whole-repo baseline.)

Run: `cd admin-frontend && npm run test`
Expected: all green — the existing suite (~507 tests) plus the 7 new ones; no call-site regressions (Spinner is a drop-in; `size` is opt-in and `label` still works).

Run: `cd admin-frontend && npm run build`
Expected: build succeeds (static export). The ice-cube renders with no `window`/JS, so no prerender errors.

- [ ] **Step 7: Commit (admin pathspec discipline)**

```bash
cd admin-frontend
git add src/components/ui/spinner.tsx src/components/ui/spinner.css src/components/ui/spinner.test.tsx
git commit -m "feat(ui): ice-cube Spinner (melt/refreeze), drop-in with PageLoader"
git show --stat HEAD   # confirm ONLY these three files
```

Expected: only the three files in the commit; foreign uncommitted changes untouched.

---

### Task 2: Distribute to id-frontend (verbatim copy + build)

**Files:**
- Create: `id-frontend/src/components/ui/spinner.css`
- Modify (replace contents): `id-frontend/src/components/ui/spinner.tsx`

**Interfaces:**
- Consumes: the exact `spinner.tsx` + `spinner.css` produced in Task 1.
- Produces: id-frontend's `Spinner`/`PageLoader` now the ice cube; existing id call sites (`<Spinner className={...} />` and `<PageLoader />`) keep compiling unchanged.

- [ ] **Step 1: Copy both files verbatim from admin**

Run:
```bash
cd /Volumes/Projects/My/CyberICEBox
cp admin-frontend/src/components/ui/spinner.css id-frontend/src/components/ui/spinner.css
cp admin-frontend/src/components/ui/spinner.tsx id-frontend/src/components/ui/spinner.tsx
```

The files are identical byte-for-byte (both apps import `cn` from `@/utils/cn`). This replaces id's old lucide/circle `Spinner`+`PageLoader` with the ice cube. id's `Spinner` previously took only `{className}` — the new one adds optional `size`/`label`, so every existing `<Spinner className={...} />` call still type-checks, and `PageLoader` is still exported.

- [ ] **Step 2: Verify the copy is byte-identical**

Run: `cd /Volumes/Projects/My/CyberICEBox && diff admin-frontend/src/components/ui/spinner.tsx id-frontend/src/components/ui/spinner.tsx && diff admin-frontend/src/components/ui/spinner.css id-frontend/src/components/ui/spinner.css && echo IDENTICAL`
Expected: `IDENTICAL` (no diff output).

- [ ] **Step 3: Build id-frontend**

Run: `cd id-frontend && npm run build`
Expected: build succeeds. id has no vitest/testing-library, so the build (Next typecheck + static export) is the gate. All existing `Spinner`/`PageLoader` call sites compile against the superset API.

If the build reports a missing `@testing-library`/vitest type or similar, that means a stray test file was copied — do NOT copy `spinner.test.tsx` into id (it has no test infra); only `spinner.tsx` + `spinner.css` belong here.

- [ ] **Step 4: Commit (id-frontend)**

```bash
cd id-frontend
git status --short   # note the current branch and any pre-existing dirty files first
git add src/components/ui/spinner.tsx src/components/ui/spinner.css
git commit -m "feat(ui): adopt shared ice-cube Spinner (COPY-TO-RP-APPS)"
git show --stat HEAD  # confirm only these two files
```

Expected: only the two files committed. If id-frontend has unrelated dirty files, stage only these two paths (never `git add -A`).

---

### Task 3: Distribute to main-frontend (add + build)

**Files:**
- Create: `main-frontend/src/components/ui/spinner.css`
- Create: `main-frontend/src/components/ui/spinner.tsx`

**Interfaces:**
- Consumes: the exact `spinner.tsx` + `spinner.css` from Task 1.
- Produces: main-frontend now has the ice-cube `Spinner`/`PageLoader` available (main currently has no spinner and zero usages — this makes it available for its loading states).

- [ ] **Step 1: Confirm the target directory exists, then copy both files verbatim**

Run:
```bash
cd /Volumes/Projects/My/CyberICEBox
ls main-frontend/src/components/ui/ >/dev/null   # verify the ui dir exists (main uses @/utils/cn + shadcn ui)
cp admin-frontend/src/components/ui/spinner.css main-frontend/src/components/ui/spinner.css
cp admin-frontend/src/components/ui/spinner.tsx main-frontend/src/components/ui/spinner.tsx
```

If `main-frontend/src/components/ui/` does not exist, create it (`mkdir -p main-frontend/src/components/ui`) before copying — main uses the same `@/utils/cn` alias, so the component resolves.

- [ ] **Step 2: Verify the copy is byte-identical**

Run: `cd /Volumes/Projects/My/CyberICEBox && diff admin-frontend/src/components/ui/spinner.tsx main-frontend/src/components/ui/spinner.tsx && diff admin-frontend/src/components/ui/spinner.css main-frontend/src/components/ui/spinner.css && echo IDENTICAL`
Expected: `IDENTICAL`.

- [ ] **Step 3: Build main-frontend**

Run: `cd main-frontend && npm run build`
Expected: build succeeds. main has no test infra, so the build is the gate. The component is unused (no call sites yet), so it must at least compile and tree-shake cleanly.

If the build fails because `@/utils/cn` doesn't resolve in main, stop and report — do not invent an import path; confirm main's `cn` location first (it was verified to import from `@/utils/cn` in `main-frontend/src/components/ui/button.tsx`).

- [ ] **Step 4: Commit (main-frontend)**

```bash
cd main-frontend
git status --short   # note branch + pre-existing dirty files
git add src/components/ui/spinner.tsx src/components/ui/spinner.css
git commit -m "feat(ui): add shared ice-cube Spinner (COPY-TO-RP-APPS)"
git show --stat HEAD  # confirm only these two files
```

Expected: only the two files committed; stage only these paths if the repo has unrelated dirty files.

---

## Self-Review (writing-plans)

1. **Spec coverage:** concept/variant-A → Task 1 CSS+SVG; drop-in `Spinner` + `size` → Task 1 API; `PageLoader` superset (id needs it) → Task 1; SVG+CSS/no-libs/SSR-safe → Task 1 (build step); `prefers-reduced-motion` → Task 1 CSS; color (ice default + button-inherit) → Task 1 CSS; COPY-TO-RP-APPS to id/main → Tasks 2–3; test only in admin → Task 1 (id/main build-gated per Global Constraints). All spec sections covered. Spec's "test copyable to all apps" line is superseded here: id/main lack test infra, so they are build-verified (documented in Global Constraints + Tasks 2–3).
2. **Placeholder scan:** no TBD/TODO; full CSS, full component, full test code provided; exact paths and commands throughout. Clean.
3. **Type consistency:** `Spinner({size?,label?,className?})` and `PageLoader({label?})` names/shapes identical across Task 1 (definition), Tasks 2–3 (verbatim copy), and the test. `SIZE_CLASS` keys (sm/md/lg) match the `.ice-loader-*` CSS classes and the test's assertions. `cn` from `@/utils/cn` consistent across all three apps.
