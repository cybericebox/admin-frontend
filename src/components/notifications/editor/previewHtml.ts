/**
 * previewHtml.ts — Lexical→HTML block renderer for the email body preview.
 *
 * Security rules mirror the SP1 backend renderer
 * (AP Backend/internal/useCase/notification/channels/render/blocks.go):
 *   - All literal text and variable VALUES are HTML-escaped.
 *   - Link / button / image URLs pass through safeURL (http/https/mailto/
 *     root-relative starting with single "/", fragment "#"; everything else → "#").
 *   - Heading tags are allowlisted to h1/h2/h3; unknown → h2.
 *   - CSS values in style attributes are sanitised (safeCSSValue).
 *   - Button URLs have {{var}} tokens substituted before safeURL.
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
export type PresetBlock = { type: 'preset'; preset_id: string; name: string }

export type EmailBodyBlock =
  | RichTextBlock
  | ButtonBlock
  | DividerBlock
  | ImageBlock
  | PresetBlock

// ── Brand constant ─────────────────────────────────────────────────────────────
// TODO: replace with brand logo asset when available
const BRAND_WORDMARK = 'CyberICEBox'

// ── Security helpers ──────────────────────────────────────────────────────────

/** Escape &, <, >, " for safe HTML attribute / content output. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&#34;')
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

/**
 * Heading tag allowlist (matches blocks.go safeHeadingTag):
 *   permitted: h1, h2, h3 — anything else → h2
 */
function safeHeadingTag(tag: string): string {
  if (tag === 'h1' || tag === 'h2' || tag === 'h3') return tag
  return 'h2'
}

/**
 * Alignment allowlist (matches blocks.go safeAlign):
 *   permitted: left, center, right, justify — else left
 */
function safeAlign(align: string | undefined): string {
  if (
    align === 'left' ||
    align === 'center' ||
    align === 'right' ||
    align === 'justify'
  ) {
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
const substitutePat = /\{\{\s*(\w+)\s*\}\}/g
function substitute(s: string, vars: Record<string, string>): string {
  return s.replace(substitutePat, (_, key: string) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : ''
  })
}

// ── Lexical → HTML ────────────────────────────────────────────────────────────

/**
 * Recursively converts a single Lexical node to HTML.
 *
 * Mirrors lexicalNodeToHtml from ai-tutor page.tsx with backend-grade escaping:
 *   - text content is always HTML-escaped
 *   - variable values are HTML-escaped (no styled span — matches backend output)
 *   - link href passes through safeURL
 *   - heading tag passes through safeHeadingTag
 */
export function lexicalNodeToHtml(
  node: unknown,
  previewValues: Record<string, string>
): string {
  const n = node as Record<string, unknown>
  const type = n.type as string
  const children = (n.children as unknown[] | undefined) ?? []
  const childHtml = children.map((c) => lexicalNodeToHtml(c, previewValues)).join('')

  switch (type) {
    case 'paragraph': {
      const fmt = (n.format as string) ?? ''
      const alignStyle =
        fmt === 'center' || fmt === 'right' || fmt === 'justify'
          ? `text-align:${fmt};`
          : ''
      return `<p style="margin:0 0 16px 0;${alignStyle}">${childHtml}</p>`
    }

    case 'heading': {
      const rawTag = (n.tag as string) ?? 'h2'
      const tag = safeHeadingTag(rawTag)
      const sizes: Record<string, string> = { h1: '24px', h2: '20px', h3: '16px' }
      const size = sizes[tag] ?? '20px'
      const fmt = (n.format as string) ?? ''
      const alignStyle =
        fmt === 'center' || fmt === 'right' || fmt === 'justify'
          ? `text-align:${fmt};`
          : ''
      return `<${tag} style="font-size:${size};color:#111;line-height:1.3;margin:16px 0 8px 0;${alignStyle}">${childHtml}</${tag}>`
    }

    case 'quote':
      return `<blockquote style="margin:12px 0;padding:14px 18px;background:#ccfbf1;border-left:3px solid #0d9488;font-style:italic;color:#0f766e;">${childHtml}</blockquote>`

    case 'list': {
      const lt = (n.listType as string) ?? 'bullet'
      const tag = lt === 'number' ? 'ol' : 'ul'
      return `<${tag} style="margin:0 0 16px 0;padding-left:24px;">${childHtml}</${tag}>`
    }

    case 'listitem':
      return `<li style="margin:4px 0;">${childHtml}</li>`

    case 'linebreak':
      return '<br/>'

    case 'link': {
      const url = (n.url as string) ?? ''
      return `<a href="${escapeHtml(safeURL(url))}" style="color:#0d9488;">${childHtml}</a>`
    }

    case 'text': {
      const rawText = (n.text as string) ?? ''
      const fmt = (n.format as number) ?? 0
      let result = escapeHtml(rawText)
      // Format bitmask (matches backend blocks.go): 1=bold, 2=italic, 4=s, 8=u, 16=code
      if (fmt & 16)
        result = `<code style="font-family:monospace;background:#f5f5f5;padding:1px 4px;border-radius:3px;">${result}</code>`
      if (fmt & 1) result = `<strong style="font-weight:bold;">${result}</strong>`
      if (fmt & 2) result = `<em style="font-style:italic;">${result}</em>`
      if (fmt & 4) result = `<s style="text-decoration:line-through;">${result}</s>`
      if (fmt & 8) result = `<u style="text-decoration:underline;">${result}</u>`
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
 * Converts a single EmailBodyBlock to an HTML string.
 *
 * Security rules applied:
 *   - Button URL: substitute {{vars}} first, then safeURL, then escapeHtml.
 *   - Image URL: safeURL + escapeHtml.
 *   - Button label, image alt: escapeHtml.
 *   - Preset: expanded recursively via presets map (missing → "").
 */
export function renderBlockToHtml(
  block: EmailBodyBlock,
  presets: Record<string, EmailBodyBlock[]>,
  previewValues: Record<string, string>
): string {
  switch (block.type) {
    case 'rich_text': {
      const root = block.content.root as { children: unknown[] }
      return (root.children ?? [])
        .map((c) => lexicalNodeToHtml(c, previewValues))
        .join('')
    }

    case 'divider':
      return '<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />'

    case 'button': {
      if (!block.label && !block.url) return ''
      const substituted = substitute(block.url, previewValues)
      const safeHref = escapeHtml(safeURL(substituted))
      const label = escapeHtml(block.label)
      const align = safeAlign(block.align)
      return (
        `<div style="margin:16px 0;text-align:${align};">` +
        `<a href="${safeHref}" style="display:inline-block;background:#0d9488;color:#fff;` +
        `border-radius:6px;font-size:16px;padding:12px 24px;text-decoration:none;font-weight:600;">` +
        `${label}</a></div>`
      )
    }

    case 'image': {
      if (!block.url) return ''
      const safeHref = escapeHtml(safeURL(block.url))
      const alt = escapeHtml(block.alt ?? '')
      const align = safeAlign(block.align)
      const width = block.width_pct ? `${block.width_pct}%` : '100%'
      return (
        `<div style="margin:12px 0;text-align:${align};">` +
        `<img src="${safeHref}" alt="${alt}" style="width:${width};display:inline-block;" /></div>`
      )
    }

    case 'preset': {
      const presetBlocks = presets[block.preset_id]
      if (!presetBlocks) return ''
      return presetBlocks
        .map((b) => renderBlockToHtml(b, presets, previewValues))
        .join('')
    }

    default: {
      const _exhaustive: never = block
      return ''
    }
  }
}

// ── Full email HTML ───────────────────────────────────────────────────────────

/**
 * Builds a complete email HTML document for the iframe preview.
 *
 * Layout: 600 px centred wrap, logo header (brand wordmark), then body blocks.
 * Styling values are sanitised with safeCSSValue before insertion.
 */
export function buildPreviewHtml(
  body: EmailBodyBlock[],
  styling: Record<string, unknown>,
  presets: Record<string, EmailBodyBlock[]>,
  previewValues: Record<string, string>
): string {
  const fontFamily = safeCSSValue(String(styling['font_family'] ?? 'Helvetica,Arial,sans-serif'))
  const textColor = safeCSSValue(String(styling['text_color'] ?? '#333'))

  const bodyHtml = body
    .map((b) => renderBlockToHtml(b, presets, previewValues))
    .join('')

  return (
    `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f9f5f0;">` +
    `<div style="font-family:${fontFamily};color:${textColor};font-size:16px;` +
    `line-height:1.5;max-width:600px;margin:0 auto;padding:24px;background:#fff;">` +
    `<div style="font-weight:700;font-size:18px;margin-bottom:24px;color:#111;">${BRAND_WORDMARK}</div>` +
    `${bodyHtml}` +
    `</div></body></html>`
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
