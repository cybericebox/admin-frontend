import { afterEach, describe, it, expect } from 'vitest'
import {
  convertTypedToken,
  rawToHtml,
  htmlToRaw,
  htmlToRawSingleLine,
  insertVariablePill,
} from './variableUtils'

// ── rawToHtml ─────────────────────────────────────────────────────────────────

describe('rawToHtml – bare mode (default)', () => {
  it('wraps a known variable in a var-pill span', () => {
    const result = rawToHtml('Hi {{Name}}', ['Name'])
    expect(result).toContain('class="var-pill"')
    expect(result).toContain('data-var="Name"')
    // pill text is just the name, no braces
    expect(result).toContain('>Name<')
    // original token is gone
    expect(result).not.toMatch(/\{\{Name\}\}/)
  })

  it('preserves surrounding literal text', () => {
    const result = rawToHtml('Hello {{Name}}, welcome!', ['Name'])
    expect(result).toContain('Hello ')
    expect(result).toContain(', welcome!')
    expect(result).toContain('data-var="Name"')
  })

  it('leaves an unknown {{X}} as escaped literal, no pill', () => {
    const result = rawToHtml('{{X}}', [])
    expect(result).not.toContain('var-pill')
    expect(result).not.toContain('<span')
    // still present as plain text (no HTML chars to escape in {{X}})
    expect(result).toContain('{{X}}')
  })

  it('HTML-escapes XSS in literal text', () => {
    const result = rawToHtml('<script>alert(1)</script>', [])
    expect(result).not.toContain('<script>')
    expect(result).toContain('&lt;script&gt;')
    expect(result).toContain('&lt;/script&gt;')
  })

  it('HTML-escapes & in literal text', () => {
    const result = rawToHtml('Tom & Jerry', [])
    expect(result).toContain('Tom &amp; Jerry')
  })
})

describe('rawToHtml – dotted mode', () => {
  it('with dotted:true, parses {{.Name}} and emits the same var-pill span', () => {
    const result = rawToHtml('Hi {{.Name}}', ['Name'], { dotted: true })
    expect(result).toContain('class="var-pill"')
    expect(result).toContain('data-var="Name"')
    expect(result).toContain('>Name<')
    expect(result).not.toMatch(/\{\{\.Name\}\}/)
  })

  it('dotted mode also reads a bare {{Name}} token as the variable', () => {
    const result = rawToHtml('Hi {{Name}}', ['Name'], { dotted: true })
    expect(result).toContain('data-var="Name"')
    expect(htmlToRaw(result, { dotted: true })).toBe('Hi {{.Name}}')
  })
})

describe('rawToHtml – every spelling of a token is a pill', () => {
  it.each(['{{Name}}', '{{.Name}}', '{{ Name }}', '{{ .Name }}', '{{. Name}}'])('%s', (token) => {
    for (const dotted of [false, true]) {
      const result = rawToHtml(`Hi ${token}!`, ['Name'], { dotted })
      expect(result).toContain('data-var="Name"')
      expect(result).not.toContain('data-invalid')
      expect(result).not.toContain('{{')
    }
  })
})

describe('rawToHtml – unknown variables are flagged', () => {
  it('turns an unknown name into an invalid pill once the list is loaded', () => {
    const result = rawToHtml('Hi {{ghost}} and {{Name}}', ['Name'])
    expect(result).toContain('class="var-pill var-pill-invalid" data-var="ghost" data-invalid="true"')
    expect(result).toContain('title="Невідома змінна «ghost»')
    expect(result).toContain('<span class="var-pill" data-var="Name">Name</span>')
    expect(htmlToRaw(result)).toBe('Hi {{ghost}} and {{Name}}')
  })

  it('leaves tokens as plain text while the variable list is empty (not loaded)', () => {
    const result = rawToHtml('Hi {{Name}} {{ghost}}', [])
    expect(result).toBe('Hi {{Name}} {{ghost}}')
  })

  it('re-renders the same field with pills once the list arrives', () => {
    const before = rawToHtml('{{.Name}}', [], { dotted: true })
    expect(before).toBe('{{.Name}}')
    expect(rawToHtml(htmlToRaw(before, { dotted: true }), ['Name'], { dotted: true })).toContain('data-var="Name"')
  })
})

describe('convertTypedToken', () => {
  function caretAtEndOf(text: string): void {
    const host = document.createElement('div')
    host.contentEditable = 'true'
    host.textContent = text
    document.body.appendChild(host)
    const node = host.firstChild as Text
    const range = document.createRange()
    range.setStart(node, text.length)
    range.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  afterEach(() => { document.body.innerHTML = '' })

  it('turns a completed known token before the caret into a pill', () => {
    caretAtEndOf('Hi {{ Name }}')
    expect(convertTypedToken(['Name'])).toBe(true)
    const pill = document.querySelector('[data-var="Name"]')
    expect(pill?.getAttribute('data-invalid')).toBeNull()
    expect(document.body.textContent).toContain('Hi ')
    expect(document.body.textContent).not.toContain('{{')
  })

  it('flags an unknown name', () => {
    caretAtEndOf('{{.ghost}}')
    expect(convertTypedToken(['Name'])).toBe(true)
    const pill = document.querySelector('[data-var="ghost"]')
    expect(pill?.getAttribute('data-invalid')).toBe('true')
    expect(pill?.className).toContain('var-pill-invalid')
    expect(pill?.getAttribute('title')).toContain('ghost')
  })

  it('does nothing for an unfinished token or while the list is empty', () => {
    caretAtEndOf('{{Nam')
    expect(convertTypedToken(['Name'])).toBe(false)
    document.body.innerHTML = ''
    caretAtEndOf('{{Name}}')
    expect(convertTypedToken([])).toBe(false)
    expect(document.body.textContent).toContain('{{Name}}')
  })
})

// ── htmlToRaw ─────────────────────────────────────────────────────────────────

describe('htmlToRaw – round-trip', () => {
  it('bare round-trip: htmlToRaw(rawToHtml(x, vars)) === x', () => {
    const input = 'Hi {{Name}}, welcome!'
    const html = rawToHtml(input, ['Name'])
    expect(htmlToRaw(html)).toBe(input)
  })

  it('dotted round-trip: htmlToRaw(rawToHtml(x, vars, {dotted}), {dotted}) === x', () => {
    const input = 'Subject: {{.Title}} update'
    const html = rawToHtml(input, ['Title'], { dotted: true })
    expect(htmlToRaw(html, { dotted: true })).toBe(input)
  })

  it('preserves non-pill HTML markup', () => {
    const html = '<b>Hello</b> <span class="var-pill" data-var="Name">Name</span>'
    expect(htmlToRaw(html)).toBe('<b>Hello</b> {{Name}}')
  })
})

// ── htmlToRawSingleLine ───────────────────────────────────────────────────────

describe('htmlToRawSingleLine', () => {
  it('converts pills to bare tokens and strips all other HTML', () => {
    const html = '<b>Hello</b> <span class="var-pill" data-var="Name">Name</span>'
    const result = htmlToRawSingleLine(html)
    expect(result).toBe('Hello {{Name}}')
    expect(result).not.toContain('<')
    expect(result).not.toContain('>')
  })

  it('uses dotted token form when dotted:true', () => {
    const html = '<span class="var-pill" data-var="Title">Title</span>'
    expect(htmlToRawSingleLine(html, { dotted: true })).toBe('{{.Title}}')
  })

  it('collapses br tags and trims whitespace', () => {
    const html = '  Hello<br/><span class="var-pill" data-var="Name">Name</span>  '
    const result = htmlToRawSingleLine(html)
    expect(result).not.toContain('<br')
    expect(result).toBe('Hello{{Name}}')
  })

  it('unescapes HTML entities in literal text', () => {
    expect(htmlToRawSingleLine('Tom &amp; Jerry')).toBe('Tom & Jerry')
  })

  it('round-trips text containing & through subject/preheader', () => {
    const input = 'Order & payment for {{.Name}}'
    const html = rawToHtml(input, ['Name'], { dotted: true })
    expect(htmlToRawSingleLine(html, { dotted: true })).toBe(input)
  })
})

// ── insertVariablePill ────────────────────────────────────────────────────────

describe('insertVariablePill', () => {
  it('returns false when no DOM selection is present (jsdom has no active range)', () => {
    // In jsdom there is no focused contentEditable with an active range,
    // so the function must return false without throwing.
    expect(() => insertVariablePill('Name')).not.toThrow()
    expect(insertVariablePill('Name')).toBe(false)
  })
})
