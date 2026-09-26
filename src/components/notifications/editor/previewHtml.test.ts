import { describe, it, expect } from 'vitest'
import {
  lexicalNodeToHtml,
  renderBlockToHtml,
  buildPreviewHtml,
  defaultBlockForType,
} from './previewHtml'
import type { EmailBodyBlock, LexicalEditorState } from './emailBlocks'

// ── Node factories ─────────────────────────────────────────────────────────────

const textNode = (text: string, format = 0) => ({ type: 'text', text, format })
const variableNode = (varName: string) => ({ type: 'variable', varName })
const paragraphNode = (...children: unknown[]) => ({ type: 'paragraph', children })
const headingNode = (tag: string, ...children: unknown[]) => ({ type: 'heading', tag, children })
const linkNode = (url: string, ...children: unknown[]) => ({ type: 'link', url, children })
const linebreakNode = () => ({ type: 'linebreak' })
const listNode = (listType: string, ...children: unknown[]) => ({ type: 'list', listType, children })
const listitemNode = (...children: unknown[]) => ({ type: 'listitem', children })

const richTextBlock = (children: unknown[]): EmailBodyBlock => ({
  type: 'rich_text',
  content: { root: { type: 'root', children, version: 1 } } as LexicalEditorState,
})

// ── lexicalNodeToHtml ─────────────────────────────────────────────────────────

describe('lexicalNodeToHtml — text node', () => {
  it('renders plain text', () => {
    expect(lexicalNodeToHtml(textNode('Hello'), {})).toBe('Hello')
  })

  it('HTML-escapes text content', () => {
    const html = lexicalNodeToHtml(textNode('<script>alert(1)</script>'), {})
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })

  it('HTML-escapes & in text', () => {
    const html = lexicalNodeToHtml(textNode('a & b'), {})
    expect(html).toContain('&amp;')
  })

  it('applies bold bitmask (1)', () => {
    const html = lexicalNodeToHtml(textNode('bold', 1), {})
    expect(html).toContain('<strong')
    expect(html).toContain('bold')
  })

  it('applies italic bitmask (2)', () => {
    const html = lexicalNodeToHtml(textNode('ital', 2), {})
    expect(html).toContain('<em')
  })

  it('applies strikethrough bitmask (4)', () => {
    const html = lexicalNodeToHtml(textNode('strike', 4), {})
    expect(html).toContain('<s')
  })

  it('applies underline bitmask (8)', () => {
    const html = lexicalNodeToHtml(textNode('under', 8), {})
    expect(html).toContain('<u')
  })

  it('applies code bitmask (16)', () => {
    const html = lexicalNodeToHtml(textNode('code', 16), {})
    expect(html).toContain('<code')
  })
})

describe('lexicalNodeToHtml — variable node', () => {
  it('resolves varName from previewValues', () => {
    const html = lexicalNodeToHtml(variableNode('name'), { name: 'Ann' })
    expect(html).toContain('Ann')
  })

  it('HTML-escapes variable value (XSS block)', () => {
    const html = lexicalNodeToHtml(variableNode('val'), { val: '<script>' })
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })

  it('renders empty string for missing variable (matches backend)', () => {
    const html = lexicalNodeToHtml(variableNode('missing'), {})
    expect(html).toBe('')
  })
})

describe('lexicalNodeToHtml — paragraph', () => {
  it('wraps children in <p>', () => {
    const html = lexicalNodeToHtml(paragraphNode(textNode('Hi')), {})
    expect(html).toContain('<p')
    expect(html).toContain('Hi')
    expect(html).toContain('</p>')
  })

  it('paragraph with text + variable contains concatenated text inline', () => {
    const node = paragraphNode(textNode('Hello '), variableNode('name'))
    const html = lexicalNodeToHtml(node, { name: 'Ann' })
    expect(html).toContain('<p')
    expect(html).toContain('Hello Ann')
  })
})

describe('lexicalNodeToHtml — heading', () => {
  it('renders h1 tag', () => {
    const html = lexicalNodeToHtml(headingNode('h1', textNode('Title')), {})
    expect(html).toContain('<h1')
    expect(html).toContain('</h1>')
  })

  it('renders h3 tag', () => {
    const html = lexicalNodeToHtml(headingNode('h3', textNode('Sub')), {})
    expect(html).toContain('<h3')
  })

  it('preserves h4 supported by the backend', () => {
    const html = lexicalNodeToHtml(headingNode('h4', textNode('Bad')), {})
    expect(html).toContain('<h4')
  })

  it('preserves h5 supported by the backend', () => {
    const html = lexicalNodeToHtml(headingNode('h5', textNode('Bad')), {})
    expect(html).toContain('<h5')
  })
})

describe('lexicalNodeToHtml — link', () => {
  it('renders <a> with href for https:// URL', () => {
    const html = lexicalNodeToHtml(linkNode('https://example.com', textNode('click')), {})
    expect(html).toContain('<a')
    expect(html).toContain('https://example.com')
  })

  it('blocks javascript: URL → href="#"', () => {
    const html = lexicalNodeToHtml(linkNode('javascript:alert(1)', textNode('x')), {})
    expect(html).not.toContain('javascript:')
    expect(html).toContain('href="#"')
  })

  it('blocks protocol-relative // URL → href="#"', () => {
    const html = lexicalNodeToHtml(linkNode('//evil.com', textNode('x')), {})
    expect(html).not.toContain('//evil.com')
    expect(html).toContain('href="#"')
  })

  it('allows root-relative / URL', () => {
    const html = lexicalNodeToHtml(linkNode('/about', textNode('About')), {})
    expect(html).toContain('/about')
  })

  it('allows fragment # URL', () => {
    const html = lexicalNodeToHtml(linkNode('#section', textNode('Go')), {})
    expect(html).toContain('#section')
  })

  it('allows mailto: URL', () => {
    const html = lexicalNodeToHtml(linkNode('mailto:a@b.com', textNode('mail')), {})
    expect(html).toContain('mailto:a@b.com')
  })

  it('blocks data: URL → href="#"', () => {
    const html = lexicalNodeToHtml(linkNode('data:text/html,<h1>x</h1>', textNode('x')), {})
    expect(html).toContain('href="#"')
    expect(html).not.toContain('data:')
  })
})

describe('lexicalNodeToHtml — list', () => {
  it('renders bullet list as <ul>', () => {
    const html = lexicalNodeToHtml(
      listNode('bullet', listitemNode(textNode('item'))),
      {}
    )
    expect(html).toContain('<ul')
    expect(html).toContain('<li')
    expect(html).toContain('item')
  })

  it('renders number list as <ol>', () => {
    const html = lexicalNodeToHtml(
      listNode('number', listitemNode(textNode('one'))),
      {}
    )
    expect(html).toContain('<ol')
  })
})

describe('lexicalNodeToHtml — linebreak', () => {
  it('renders <br/>', () => {
    const html = lexicalNodeToHtml(linebreakNode(), {})
    expect(html).toBe('<br/>')
  })
})

// ── renderBlockToHtml ─────────────────────────────────────────────────────────

describe('renderBlockToHtml — rich_text', () => {
  it('paragraph with text + variable → "Hello Ann" inside <p', () => {
    const block = richTextBlock([paragraphNode(textNode('Hello '), variableNode('name'))])
    const html = renderBlockToHtml(block, {}, { name: 'Ann' })
    expect(html).toContain('<p')
    expect(html).toContain('Hello Ann')
  })

  it('escapes dangerous variable value in rich_text', () => {
    const block = richTextBlock([paragraphNode(variableNode('x'))])
    const html = renderBlockToHtml(block, {}, { x: '<script>' })
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })
})

describe('renderBlockToHtml — divider', () => {
  it('renders <hr', () => {
    const html = renderBlockToHtml({ type: 'divider' }, {}, {})
    expect(html).toContain('<hr')
  })
})

describe('renderBlockToHtml — button', () => {
  it('renders <a> with label and url', () => {
    const html = renderBlockToHtml(
      { type: 'button', label: 'Click me', url: 'https://example.com' },
      {},
      {}
    )
    expect(html).toContain('<a')
    expect(html).toContain('Click me')
    expect(html).toContain('https://example.com')
  })

  it('substitutes {{var}} in button URL from previewValues', () => {
    const html = renderBlockToHtml(
      { type: 'button', label: 'Go', url: 'https://example.com/{{user}}' },
      {},
      { user: 'alice' }
    )
    expect(html).toContain('https://example.com/alice')
  })

  it('blocks javascript: in button URL → href="#"', () => {
    const html = renderBlockToHtml(
      { type: 'button', label: 'Bad', url: 'javascript:alert(1)' },
      {},
      {}
    )
    expect(html).not.toContain('javascript:')
    expect(html).toContain('href="#"')
  })

  it('blocks protocol-relative // in button URL → href="#"', () => {
    const html = renderBlockToHtml(
      { type: 'button', label: 'Bad', url: '//evil.com' },
      {},
      {}
    )
    expect(html).not.toContain('//evil.com')
    expect(html).toContain('href="#"')
  })

  it('HTML-escapes button label', () => {
    const html = renderBlockToHtml(
      { type: 'button', label: '<b>Hi</b>', url: 'https://x.com' },
      {},
      {}
    )
    expect(html).toContain('&lt;b&gt;Hi&lt;/b&gt;')
    expect(html).not.toContain('<b>Hi</b>')
  })

  it('preserves legit https:// button URL', () => {
    const html = renderBlockToHtml(
      { type: 'button', label: 'Go', url: 'https://safe.example.com/path?q=1' },
      {},
      {}
    )
    expect(html).toContain('https://safe.example.com/path?q=1')
  })
})

describe('renderBlockToHtml — image', () => {
  it('renders <img> with src and alt', () => {
    const html = renderBlockToHtml(
      { type: 'image', url: 'https://example.com/img.png', alt: 'Test image' },
      {},
      {}
    )
    expect(html).toContain('<img')
    expect(html).toContain('https://example.com/img.png')
    expect(html).toContain('alt="Test image"')
  })

  it('blocks javascript: in image URL → src="#"', () => {
    const html = renderBlockToHtml(
      { type: 'image', url: 'javascript:alert(1)', alt: '' },
      {},
      {}
    )
    expect(html).not.toContain('javascript:')
    expect(html).toContain('src="#"')
  })

  it('returns empty string for image with no url', () => {
    const html = renderBlockToHtml({ type: 'image' }, {}, {})
    expect(html).toBe('')
  })

  it('M2: width_pct is rendered as CSS-safe percentage', () => {
    const html = renderBlockToHtml(
      { type: 'image', url: 'https://example.com/img.png', alt: '', width_pct: 50 },
      {},
      {}
    )
    expect(html).toContain('width:50%')
  })
})

describe('renderBlockToHtml — preset', () => {
  it('expands preset blocks from the presets map', () => {
    const presets = {
      'preset-1': [
        { type: 'divider' as const },
        richTextBlock([paragraphNode(textNode('Preset content'))]),
      ],
    }
    const html = renderBlockToHtml(
      { type: 'preset', preset_id: 'preset-1', name: 'My Preset' },
      presets,
      {}
    )
    expect(html).toContain('<hr')
    expect(html).toContain('Preset content')
  })

  it('returns empty string for unknown preset id', () => {
    const html = renderBlockToHtml(
      { type: 'preset', preset_id: 'nonexistent', name: 'X' },
      {},
      {}
    )
    expect(html).toBe('')
  })
})

// ── renderBlockToHtml — logo ──────────────────────────────────────────────────
// The browser-side preview has no brand/logo URL (server-side only), so this
// legacy renderer intentionally renders nothing for a logo block.

describe('renderBlockToHtml — logo', () => {
  it('renders as empty string (no client-side brand/logo URL)', () => {
    const html = renderBlockToHtml({ type: 'logo' }, {}, {})
    expect(html).toBe('')
  })
})

// ── buildPreviewHtml ──────────────────────────────────────────────────────────

describe('buildPreviewHtml', () => {
  it('returns a full HTML document', () => {
    const html = buildPreviewHtml([], {}, {}, {})
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<body')
  })

  it('does not add a wordmark that is absent from the delivered email', () => {
    const html = buildPreviewHtml([], {}, {}, {})
    expect(html).not.toContain('CyberICEBox')
  })

  it('does NOT contain legacy "GenAI.works" brand string', () => {
    const html = buildPreviewHtml([], {}, {}, {})
    expect(html).not.toContain('GenAI.works')
  })

  it('includes rendered body blocks', () => {
    const html = buildPreviewHtml(
      [richTextBlock([paragraphNode(textNode('Hello world'))])],
      {},
      {},
      {}
    )
    expect(html).toContain('Hello world')
  })

  it('expands preset blocks inline', () => {
    const presets = {
      'p1': [richTextBlock([paragraphNode(textNode('From preset'))])],
    }
    const html = buildPreviewHtml(
      [{ type: 'preset', preset_id: 'p1', name: 'P1' }],
      {},
      presets,
      {}
    )
    expect(html).toContain('From preset')
  })
})

// ── defaultBlockForType ───────────────────────────────────────────────────────

describe('defaultBlockForType', () => {
  it('returns rich_text block with empty root', () => {
    const b = defaultBlockForType('rich_text')
    expect(b.type).toBe('rich_text')
    if (b.type === 'rich_text') {
      expect(b.content.root.children).toEqual([])
    }
  })

  it('returns button block with empty label and url', () => {
    const b = defaultBlockForType('button')
    expect(b.type).toBe('button')
    if (b.type === 'button') {
      expect(b.label).toBe('')
      expect(b.url).toBe('')
    }
  })

  it('returns divider block', () => {
    const b = defaultBlockForType('divider')
    expect(b.type).toBe('divider')
  })

  it('returns image block', () => {
    const b = defaultBlockForType('image')
    expect(b.type).toBe('image')
  })

  it('returns preset block', () => {
    const b = defaultBlockForType('preset')
    expect(b.type).toBe('preset')
  })

  it('returns logo block', () => {
    const b = defaultBlockForType('logo')
    expect(b.type).toBe('logo')
  })
})

// ── Backend-parity regressions (fix wave) ─────────────────────────────────────

describe('text format nesting parity', () => {
  it('code wraps OUTSIDE bold (matches backend nesting order)', () => {
    const html = lexicalNodeToHtml(textNode('x', 1 | 16), {})
    // code is the outermost element: <code ...><strong ...>x</strong></code>
    expect(html.indexOf('<code')).toBeLessThan(html.indexOf('<strong'))
    expect(html).toContain('</strong></code>')
  })

  it("escapes single quote ' to &#39; (matches Go html.EscapeString)", () => {
    expect(lexicalNodeToHtml(textNode("it's"), {})).toContain('&#39;')
  })
})

describe('styling threading parity', () => {
  it('threads a custom cta_bg_color into the button style', () => {
    const html = buildPreviewHtml(
      [{ type: 'button', label: 'Go', url: 'https://x.com' }],
      { cta_bg_color: '#ff0000' },
      {},
      {}
    )
    expect(html).toContain('background-color:#ff0000')
  })

  it('uses the backend default cta_bg_color when styling omits it', () => {
    const html = buildPreviewHtml(
      [{ type: 'button', label: 'Go', url: 'https://x.com' }],
      {},
      {},
      {}
    )
    expect(html).toContain('background-color:#4F46E5')
  })

  it('threads custom heading_color via buildPreviewHtml', () => {
    const html = buildPreviewHtml(
      [richTextBlock([headingNode('h2', textNode('T'))])],
      { heading_color: '#abcdef' },
      {},
      {}
    )
    expect(html).toContain('color:#abcdef')
  })
})

describe('vbscript / data scheme blocking', () => {
  it('blocks vbscript: in link → href="#"', () => {
    const html = lexicalNodeToHtml(linkNode('vbscript:msgbox(1)', textNode('x')), {})
    expect(html).not.toContain('vbscript:')
    expect(html).toContain('href="#"')
  })

  it('blocks vbscript: in button → href="#"', () => {
    const html = renderBlockToHtml({ type: 'button', label: 'x', url: 'vbscript:msgbox(1)' }, {}, {})
    expect(html).not.toContain('vbscript:')
    expect(html).toContain('href="#"')
  })

  it('blocks vbscript: in image → src="#"', () => {
    const html = renderBlockToHtml({ type: 'image', url: 'vbscript:msgbox(1)', alt: '' }, {}, {})
    expect(html).not.toContain('vbscript:')
    expect(html).toContain('src="#"')
  })

  it('blocks data: in image URL → src="#"', () => {
    const html = renderBlockToHtml({ type: 'image', url: 'data:text/html,<h1>x</h1>', alt: '' }, {}, {})
    expect(html).not.toContain('data:')
    expect(html).toContain('src="#"')
  })
})
