/**
 * EmailPreview.test.tsx — TDD tests for the EmailPreview component.
 *
 * Verifies that EmailPreview renders a sandboxed iframe whose srcDoc
 * contains the buildPreviewHtml output with variable substitution applied.
 */

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import type { EmailBodyBlock, LexicalEditorState } from './emailBlocks'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const textNode = (text: string, format = 0) => ({ type: 'text', text, format, version: 1 })
const variableNode = (varName: string) => ({ type: 'variable', varName, version: 1 })
const paragraphNode = (...children: unknown[]) => ({
  type: 'paragraph',
  children,
  version: 1,
  direction: null,
  format: '',
  indent: 0,
  textFormat: 0,
})

function makeRichTextBlock(children: unknown[]): EmailBodyBlock {
  return {
    type: 'rich_text',
    content: {
      root: { type: 'root', children, version: 1, direction: null, format: '', indent: 0 },
    } as LexicalEditorState,
  }
}

// ── Import component (after fixtures) ─────────────────────────────────────────

import { EmailPreview } from './EmailPreview'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EmailPreview', () => {
  it('shows the rendered subject and preheader above the email body', () => {
    render(<EmailPreview subject="Hello {{.Name}}" preheader="For {{Name}}" body={[]} styling={{}} presets={{}} previewValues={{ Name: 'Ann' }} />)
    expect(document.body.textContent).toContain('Hello Ann')
    expect(document.body.textContent).toContain('For Ann')
  })
  it('renders an iframe element', () => {
    render(
      <EmailPreview
        body={[]}
        styling={{}}
        presets={{}}
        previewValues={{}}
      />
    )
    // iframe should be accessible by role
    const iframes = document.querySelectorAll('iframe')
    expect(iframes.length).toBeGreaterThan(0)
  })

  it('iframe has sandbox attribute (origin-isolated)', () => {
    render(
      <EmailPreview
        body={[]}
        styling={{}}
        presets={{}}
        previewValues={{}}
      />
    )
    const iframe = document.querySelector('iframe')
    expect(iframe).not.toBeNull()
    expect(iframe!.hasAttribute('sandbox')).toBe(true)
  })

  it('srcDoc contains <!DOCTYPE html>', () => {
    render(
      <EmailPreview
        body={[]}
        styling={{}}
        presets={{}}
        previewValues={{}}
      />
    )
    const iframe = document.querySelector('iframe')
    const srcDoc = iframe?.getAttribute('srcdoc') ?? ''
    expect(srcDoc.toLowerCase()).toContain('<!doctype html>')
  })

  it('substitutes preview variable values in the iframe srcDoc', () => {
    const body: EmailBodyBlock[] = [
      makeRichTextBlock([
        paragraphNode(
          textNode('Hello '),
          variableNode('name'),
        ),
      ]),
    ]

    render(
      <EmailPreview
        body={body}
        styling={{}}
        presets={{}}
        previewValues={{ name: 'Ann' }}
      />
    )

    const iframe = document.querySelector('iframe')
    const srcDoc = iframe?.getAttribute('srcdoc') ?? ''
    expect(srcDoc).toContain('Hello ')
    expect(srcDoc).toContain('Ann')
  })

  it('renders "Hello Ann" when body has rich_text with variable(name) and previewValues={name:"Ann"}', () => {
    const body: EmailBodyBlock[] = [
      makeRichTextBlock([
        paragraphNode(
          textNode('Hello '),
          variableNode('name'),
        ),
      ]),
    ]

    render(
      <EmailPreview
        body={body}
        styling={{}}
        presets={{}}
        previewValues={{ name: 'Ann' }}
      />
    )

    const iframe = document.querySelector('iframe')
    expect(iframe).not.toBeNull()
    const srcDoc = iframe!.getAttribute('srcdoc') ?? ''
    // Full document with substituted variable
    expect(srcDoc.toLowerCase()).toContain('<!doctype html>')
    expect(srcDoc).toContain('Hello ')
    expect(srcDoc).toContain('Ann')
    // Must NOT contain the raw variable placeholder syntax
    expect(srcDoc).not.toContain('{{name}}')
  })

  it('iframe has a title attribute (i18n)', () => {
    render(
      <EmailPreview
        body={[]}
        styling={{}}
        presets={{}}
        previewValues={{}}
      />
    )
    const iframe = document.querySelector('iframe')
    expect(iframe).not.toBeNull()
    expect(iframe!.getAttribute('title')).toBeTruthy()
  })
})
