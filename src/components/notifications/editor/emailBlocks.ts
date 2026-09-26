/**
 * emailBlocks.ts — Email body block type union + brand tokens.
 *
 * Single source of truth for the block types (moved out of previewHtml.ts,
 * which now imports them from here — see previewHtml.ts's header comment).
 * previewHtml.ts keeps its own Lexical→HTML renderer for the in-browser
 * preview; it is superseded by the backend-rendered preview
 * (emailTemplates.ts's previewEmailTemplate) and deleted in Task 12.
 */

// ── Lexical content ───────────────────────────────────────────────────────────

export type LexicalEditorState = {
  root: { children: unknown[]; type: 'root'; [k: string]: unknown }
}

// ── Block types ────────────────────────────────────────────────────────────────

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
  file_id?: string
  alt?: string
  align?: string
  width_pct?: number
}

export type PresetBlock = { type: 'preset'; preset_id: string; name: string; placement?: 'footer' }

/** Platform/Event brand logo block — rendered server-side from the brand logo asset. */
export type LogoBlock = { type: 'logo'; align?: 'left' | 'center' | 'right'; width_px?: number }

export type EmailBodyBlock =
  | RichTextBlock
  | ButtonBlock
  | DividerBlock
  | ImageBlock
  | PresetBlock
  | LogoBlock

// ── Brand tokens ───────────────────────────────────────────────────────────────

/** `theme:*` styling tokens the backend accepts. An unknown `theme:*` value is a validation error. */
export const THEME_TOKENS = ['theme:brand', 'theme:accent', 'theme:on_accent'] as const

/** Platform brand constants (constraints.md) — the fallback brand shown in the editor (Task 10). */
export const PLATFORM_BRAND: Record<string, string> = {
  'theme:brand':     '#211A52',
  'theme:accent':    '#211A52',
  'theme:on_accent': '#FFFFFF',
}
