# Platform ice-cube loader (`Spinner`) — design

**Date:** 2026-07-13
**Status:** approved (design), pending implementation plan
**Scope:** admin-frontend, id-frontend, main-frontend (shared UI component)

## Goal

Replace the plain lucide `Loader2` spinner and button-loading states across all three
CyberICEBox frontends with a single branded **isometric ice-cube** loader that melts and
refreezes on a loop. "CyberICEBox" is literally an *ICE Box*, so the ice cube is the
brand mark in motion. It must read from a 16px button spinner up to a 60px page loader.

## Concept (chosen: variant A — isometric ICE-Box)

An isometric cube (three rhombus faces: light top, mid left, dark right — the classic
"box" read). Animation loop ~2.2s:

1. **Melt** — the top face lowers and flattens, the two side faces collapse to near-zero
   height, and a puddle ellipse grows at the base.
2. **Refreeze** — faces rebuild upward, puddle shrinks away; a brief white highlight
   ("shine") flashes across the top face at the refreeze peak.

Two other variants (frost-fill block; faceted crystal + cyber shimmer) were prototyped and
rejected in favor of A as the most on-brand and recognizable.

## Component

Drop-in replacement for the existing `Spinner` — **same name and existing props kept**, so
all ~24 call sites (admin 16 + id 8) upgrade with zero changes. Adds an optional `size`.

```tsx
Spinner({
  size?: "sm" | "md" | "lg",   // default "sm"
  label?: string,               // sr-only status text (unchanged)
  className?: string,           // unchanged
})
```

- **Sizes** (glyph is `1em × 1em`, everything scales off `font-size`):
  - `sm` ≈ 20px — inline / inside buttons (default; matches today's `h-5 w-5`, so existing
    sites keep their current size).
  - `md` ≈ 32px — section / card loaders.
  - `lg` ≈ 60px — full-page / route loaders (typically centered, often with `label`).
- **Markup:** `<span role="status">` wrapping the inline `<svg viewBox="0 0 24 24">`, plus
  `{label && <span className="sr-only">{label}</span>}` — accessibility identical to today.

## Rendering & motion

- **Inline SVG + CSS `@keyframes`.** No external libraries (matches the repos' "no chart/anim
  libs" convention), no JavaScript, no `window`/`document` access → SSR- and
  static-export-safe (all three apps use `output: 'export'`).
- SVG faces use `fill="currentColor"` so the cube inherits its context's text color.
- All keyframe names are prefixed `ice-` to avoid collisions in each host app's global CSS.
- **`prefers-reduced-motion: reduce`** → animations disabled; the cube renders **static and
  fully frozen** (no melt, no puddle, no shine) and stays visible as a still loading mark.

## Color

- SVG fill = `currentColor`.
- **Default (standalone — page/section):** ice-cyan accent, concrete default `#63c1f7`
  (ice-400). Implemented in the component's CSS as
  `.ice-loader { color: var(--ice-loader-color, #63c1f7) }` so it's brand-colored by default
  but overridable via the `--ice-loader-color` variable or a text-color utility. The plan
  confirms this reads acceptably in both light and dark themes across the apps and swaps to a
  shared theme token if one exists.
- **Inside a button / colored surface:** inherits the surface's text color (e.g. white on a
  primary button). Implemented by a scoped rule shipped **with the component's CSS**:
  `button .ice-loader { color: currentColor }`. This travels with the component (no per-app
  globals edit) and gives: ice standalone, inherited in buttons — zero call-site work.
- Override precedence: to guarantee a caller's `className` text-color utility (or an
  inherited button color) wins over the default, the component applies the default **only**
  via the `--ice-loader-color` fallback (not a hard `color` on a high-specificity selector);
  the plan verifies utilities override cleanly.

## Distribution (COPY-TO-RP-APPS)

The three frontends do **not** consume the `@cybericebox/design-system` package; they share
app-agnostic code by **verbatim file copy** with a `COPY-TO-RP-APPS` header (precedent:
`src/lib/auth.ts`, `src/i18n/t.ts`). The loader follows the same pattern:

- **Two self-contained co-located files**, copied verbatim into each app's
  `src/components/ui/`:
  - `spinner.tsx` — the component (carries a `COPY-TO-RP-APPS` header naming the canonical
    source).
  - `spinner.css` — the `ice-`-prefixed keyframes + the `.ice-loader` default color and the
    `button .ice-loader` scope rule; imported by `spinner.tsx`. Bundling the CSS here means
    **no host `globals.css` changes** in any app.
- **Canonical source:** admin-frontend (the active repo). Copied verbatim into id-frontend
  and main-frontend.
- admin + id already have `src/components/ui/spinner.tsx` → replaced. main-frontend has none
  → added (available for its loading states; it currently has zero spinner usages).
- No consumer API changes anywhere: existing `<Spinner/>` / `<Spinner label={…}/>` /
  `<Spinner className={…}/>` calls keep working; `size` is opt-in.

## Testing

Per app (the component is identical, so the test is copyable too):

- Renders an SVG inside a `role="status"` element.
- `label` prop is present and `sr-only` (screen-reader accessible).
- `size` prop maps to the expected size class (sm/md/lg).
- Renders without throwing under a `prefers-reduced-motion` context (jsdom can't assert the
  animation itself; assert the static-safe markup renders).
- Existing per-app suites stay green (drop-in: no call-site changes, so no regressions).
- Manual visual check: the cube animates in the browser at all three sizes, light + dark,
  and in a button.

## Out of scope

- A separate elaborate full-screen "page melt" loader (decided: one responsive glyph only).
- Migrating the frontends onto the `@cybericebox/design-system` package (unrelated, large).
- Runtime rollout coordination across the three repos' branches/CI (each app commits on its
  own branch per its conventions; the plan sequences the copies).
- Changing which call sites use `size="lg"` vs default beyond the obvious page-level loaders
  (a light, optional polish pass, not a hard requirement).
