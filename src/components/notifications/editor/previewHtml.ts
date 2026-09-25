/**
 * previewHtml.ts — Lexical→HTML block renderer for the email body preview.
 *
 * Parity goal: the in-browser preview must equal the delivered email, so this
 * mirrors the SP1 backend renderer
 * (AP Backend/internal/useCase/notification/channels/render/blocks.go):
 *   - All literal text and variable VALUES are HTML-escaped (incl. ' → &#39;).
 *   - Link / button / image URLs pass through safeURL (http/https/mailto/
 *     root-relative single "/", fragment "#"; everything else → "#").
 *   - Heading tags are allowlisted to h1/h2/h3; unknown → h2.
 *   - Text format bitmask wraps in backend order: bold→italic→strike→underline→
 *     code, so code is the OUTERMOST element.
 *   - Paragraph/heading/button styles are composed from the per-template
 *     `styling` object (merged over the backend defaults), each value passed
 *     through safeCSSValue — so a custom cta_bg_color renders identically here
 *     and in the delivered email.
 *
 * Known divergence: the backend paragraph/heading styles do not emit a
 * `text-align`, so Lexical paragraph alignment is not reflected in delivery.
 * This preview matches that (no align) on purpose. Supporting alignment needs a
 * coordinated backend + frontend change. // TODO: honor paragraph alignment in both renderers
 */

// ── Types — single source of truth (Task 6 imports from here) ─────────────────

export type LexicalEditorState = {
  root: { children: unknown[]; type: 'root'; [k: string]: unknown }
}

export type RichTextBlock = { type: 'rich_text'; content: LexicalEditorState }
export type ButtonBlock = {
  type: 'button'
  label: string
  url: string
  align?: 'left' | 'center' | 'right'
}
export type DividerBlock = { type: 'divider' }
export type ImageBlock = {
  type: 'image'
  url?: string
  alt?: string
  width_pct?: number
  align?: 'left' | 'center' | 'right'
}
export type PresetBlock = { type: 'preset'; preset_id: string; name: string; placement?: 'footer' }

export type EmailBodyBlock =
  | RichTextBlock
  | ButtonBlock
  | DividerBlock
  | ImageBlock
  | PresetBlock

// ── Styling — mirrors blocks.go emailStyling + defaultEmailStyling ─────────────

export type ResolvedStyling = Record<string, string>

/** Backend defaultEmailStyling() — keep in sync with blocks.go. */
const DEFAULT_STYLING: ResolvedStyling = {
  font_family: 'sans-serif',
  text_color: '#333333',
  text_font_size: '14px',
  text_line_height: '1.5',
  heading_color: '#111111',
  heading_line_height: '1.3',
  paragraph_bottom_margin: '12px',
  heading_top_margin: '16px',
  heading_bottom_margin: '8px',
  cta_bg_color: '#4F46E5',
  cta_text_color: '#FFFFFF',
  cta_border_radius: '4px',
  cta_font_size: '14px',
  cta_vertical_padding: '10px',
  cta_horizontal_padding: '20px',
}

/** Merge a raw styling object over the backend defaults (only provided keys override). */
export function resolveStyling(styling: Record<string, unknown> | null | undefined): ResolvedStyling {
  const st: ResolvedStyling = { ...DEFAULT_STYLING }
  if (styling) {
    for (const k of Object.keys(DEFAULT_STYLING)) {
      const v = styling[k]
      if (v !== undefined && v !== null) st[k] = String(v)
    }
  }
  return st
}

// ── Security helpers ──────────────────────────────────────────────────────────

/** Escape &, <, >, ", ' for safe HTML (matches Go html.EscapeString). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&#34;')
    .replace(/'/g, '&#39;')
}

/**
 * URL allowlist (matches blocks.go safeURL):
 *   permitted: http://, https://, mailto:, leading "/" (NOT "//"), leading "#"
 *   blocked:   javascript:, data:, vbscript:, protocol-relative "//…", anything else
 */
function safeURL(u: string): string {
  const s = u.trim()
  const low = s.toLowerCase()
  if (
    low.startsWith('http://') ||
    low.startsWith('https://') ||
    low.startsWith('mailto:') ||
    (s.startsWith('/') && !s.startsWith('//')) ||
    s.startsWith('#')
  ) {
    return s
  }
  return '#'
}

/** Heading tag allowlist (matches blocks.go safeHeadingTag): h1/h2/h3, else h2. */
function safeHeadingTag(tag: string): string {
  if (/^h[1-6]$/.test(tag)) return tag
  return 'h2'
}

/** Alignment allowlist (matches blocks.go safeAlign): left/center/right/justify, else left. */
function safeAlign(align: string | undefined): string {
  if (align === 'left' || align === 'center' || align === 'right' || align === 'justify') {
    return align
  }
  return 'left'
}

/** Strip characters outside the CSS-safe allowlist (matches blocks.go safeCSSPat). */
const safeCSSPat = /[^-A-Za-z0-9 #.,()%]/g
function safeCSSValue(s: string): string {
  return s.replace(safeCSSPat, '')
}

/** Replace {{key}} / {{ key }} in s with vars[key] or "" (matches blocks.go substitute). */
const substitutePat = /\{\{\s*\.?(\w+)\s*\}\}/g
function substitute(s: string, vars: Record<string, string>): string {
  return s.replace(substitutePat, (_, key: string) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : ''
  })
}

// ── Lexical → HTML ────────────────────────────────────────────────────────────

/**
 * Recursively converts a single Lexical node to HTML, mirroring blocks.go
 * renderLexicalNode. Paragraph/heading styles come from `st` (resolved styling).
 */
export function lexicalNodeToHtml(
  node: unknown,
  previewValues: Record<string, string>,
  st: ResolvedStyling = DEFAULT_STYLING
): string {
  const n = node as Record<string, unknown>
  const type = n.type as string
  const children = (n.children as unknown[] | undefined) ?? []
  const childHtml = children.map((c) => lexicalNodeToHtml(c, previewValues, st)).join('')

  switch (type) {
    case 'paragraph': {
      // blocks.go: font-family;color;font-size;line-height;margin-bottom (no text-align)
      const style =
        `font-family:${safeCSSValue(st.font_family)};color:${safeCSSValue(st.text_color)};` +
        `font-size:${safeCSSValue(st.text_font_size)};line-height:${safeCSSValue(st.text_line_height)};` +
        `margin-bottom:${safeCSSValue(st.paragraph_bottom_margin)}`
      return `<p style="${style}">${childHtml}</p>`
    }

    case 'heading': {
      const tag = safeHeadingTag((n.tag as string) ?? 'h2')
      // blocks.go: color;line-height;margin-top;margin-bottom (no font-size, no align)
      const style =
        `color:${safeCSSValue(st.heading_color)};line-height:${safeCSSValue(st.heading_line_height)};` +
        `margin-top:${safeCSSValue(st.heading_top_margin)};margin-bottom:${safeCSSValue(st.heading_bottom_margin)}`
      return `<${tag} style="${style}">${childHtml}</${tag}>`
    }

    case 'quote':
      return `<blockquote>${childHtml}</blockquote>`

    case 'list': {
      const lt = (n.listType as string) ?? 'bullet'
      const tag = lt === 'number' ? 'ol' : 'ul'
      return `<${tag}>${childHtml}</${tag}>`
    }

    case 'listitem':
      return `<li>${childHtml}</li>`

    case 'linebreak':
      return '<br/>'

    case 'link': {
      const url = (n.url as string) ?? ''
      return `<a href="${escapeHtml(safeURL(substitute(url, previewValues)))}">${childHtml}</a>`
    }

    case 'text': {
      const rawText = (n.text as string) ?? ''
      const fmt = (n.format as number) ?? 0
      let result = escapeHtml(rawText)
      // Format bitmask — SAME ORDER as blocks.go so nesting matches:
      // bold(1) → italic(2) → strikethrough(4) → underline(8) → code(16, OUTERMOST).
      if (fmt & 1) result = `<strong>${result}</strong>`
      if (fmt & 2) result = `<em>${result}</em>`
      if (fmt & 4) result = `<s>${result}</s>`
      if (fmt & 8) result = `<u>${result}</u>`
      if (fmt & 16) result = `<code>${result}</code>`
      return result
    }

    case 'variable': {
      const varName = (n.varName as string) ?? ''
      // Resolve by bare varName (no dot prefix). Missing → empty string (matches backend).
      const raw = Object.prototype.hasOwnProperty.call(previewValues, varName)
        ? previewValues[varName]
        : ''
      return escapeHtml(raw)
    }

    default:
      // Unknown type — recurse into children (matches backend default case).
      return childHtml
  }
}

// ── Block → HTML ──────────────────────────────────────────────────────────────

/**
 * Converts a single EmailBodyBlock to an HTML string, mirroring blocks.go.
 * Button style comes from `st` (cta_* values); URLs go through safeURL.
 */
export function renderBlockToHtml(
  block: EmailBodyBlock,
  presets: Record<string, EmailBodyBlock[]>,
  previewValues: Record<string, string>,
  st: ResolvedStyling = DEFAULT_STYLING
): string {
  switch (block.type) {
    case 'rich_text': {
      const root = block.content.root as { children: unknown[] }
      return (root.children ?? [])
        .map((c) => lexicalNodeToHtml(c, previewValues, st))
        .join('')
    }

    case 'divider':
      return '<hr/>'

    case 'button': {
      if (!block.label && !block.url) return ''
      const substituted = substitute(block.url, previewValues)
      const safeHref = escapeHtml(safeURL(substituted))
      const label = escapeHtml(block.label)
      const align = safeAlign(block.align)
      // blocks.go button style: background-color/color/border-radius/font-size/padding from cta_*
      const padding = `${safeCSSValue(st.cta_vertical_padding)} ${safeCSSValue(st.cta_horizontal_padding)}`
      const btnStyle =
        `display:inline-block;background-color:${safeCSSValue(st.cta_bg_color)};` +
        `color:${safeCSSValue(st.cta_text_color)};border-radius:${safeCSSValue(st.cta_border_radius)};` +
        `font-size:${safeCSSValue(st.cta_font_size)};padding:${padding};text-decoration:none`
      return `<div style="text-align:${align}"><a href="${safeHref}" style="${btnStyle}">${label}</a></div>`
    }

    case 'image': {
      if (!block.url) return ''
      const safeHref = escapeHtml(safeURL(block.url))
      const alt = escapeHtml(block.alt ?? '')
      const align = safeAlign(block.align)
      const width = safeCSSValue(`${block.width_pct && block.width_pct > 0 ? block.width_pct : 100}%`)
      return `<div style="text-align:${align}"><img src="${safeHref}" alt="${alt}" style="width:${width}"/></div>`
    }

    case 'preset': {
      const presetBlocks = presets[block.preset_id]
      if (!presetBlocks) return ''
      return presetBlocks
        .map((b) => renderBlockToHtml(b, presets, previewValues, st))
        .join('')
    }

    default: {
      const _exhaustive: never = block
      void _exhaustive
      return ''
    }
  }
}

// ── Full email HTML ───────────────────────────────────────────────────────────

/**
 * Wraps the rendered fragment for iframe isolation. No visual chrome is added:
 * the mailer sends this fragment directly as an HTML email.
 */
export function buildPreviewHtml(
  body: EmailBodyBlock[],
  styling: Record<string, unknown>,
  presets: Record<string, EmailBodyBlock[]>,
  previewValues: Record<string, string>
): string {
  const st = resolveStyling(styling)
  const bodyHtml = body
    .map((b) => renderBlockToHtml(b, presets, previewValues, st))
    .join('')

  return (
    `<!DOCTYPE html><html><body>${bodyHtml}</body></html>`
  )
}

// ── Default block templates ───────────────────────────────────────────────────

const EMPTY_LEXICAL_ROOT: LexicalEditorState = {
  root: {
    children: [],
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
}

/** Returns an empty default block for the given type. */
export function defaultBlockForType(type: EmailBodyBlock['type']): EmailBodyBlock {
  switch (type) {
    case 'rich_text':
      return { type: 'rich_text', content: { ...EMPTY_LEXICAL_ROOT } }
    case 'button':
      return { type: 'button', label: '', url: '' }
    case 'divider':
      return { type: 'divider' }
    case 'image':
      return { type: 'image', alt: '' }
    case 'preset':
      return { type: 'preset', preset_id: '', name: '' }
    default: {
      const _exhaustive: never = type
      void _exhaustive
      return { type: 'rich_text', content: { ...EMPTY_LEXICAL_ROOT } }
    }
  }
}
