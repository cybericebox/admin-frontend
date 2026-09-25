/**
 * InAppPreview.test.tsx — TDD tests for inAppOptions + InAppPreview.
 *
 * Written RED-first: both files are created AFTER these tests.
 */

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TONES, toneColor, accentOf } from './inAppOptions'
import { InAppPreview } from './InAppPreview'

// ── inAppOptions unit tests ───────────────────────────────────────────────────

describe('inAppOptions', () => {
  it('toneColor("danger") returns the danger hex', () => {
    const dangerColor = TONES.find((t) => t.value === 'danger')!.color
    expect(toneColor('danger')).toBe(dangerColor)
    // Double-check the exact hex from the spec
    expect(toneColor('danger')).toBe('#DC2626')
  })

  it('toneColor("weird") returns neutral color (fallback)', () => {
    const neutralColor = TONES.find((t) => t.value === 'neutral')!.color
    expect(toneColor('weird')).toBe(neutralColor)
    expect(toneColor('weird')).toBe('#64748B')
  })

  it('accentOf returns toneColor(Tone) when AccentColor is empty', () => {
    const infoColor = TONES.find((t) => t.value === 'info')!.color
    expect(accentOf({ Tone: 'info', AccentColor: '' })).toBe(infoColor)
    expect(accentOf({ Tone: 'info', AccentColor: '' })).toBe('#0091EA')
  })

  it('accentOf returns AccentColor when non-empty (ignores Tone)', () => {
    expect(accentOf({ Tone: 'info', AccentColor: '#abc' })).toBe('#abc')
  })

  it('ignores an invalid saved accent value', () => {
    expect(accentOf({ Tone: 'warning', AccentColor: 'var(--unexpected)' })).toBe(toneColor('warning'))
  })
})

// ── InAppPreview tests ────────────────────────────────────────────────────────

const defaultProps = {
  title: 'Hello',
  body: '',
  link: '',
  icon: 'info',
  tone: 'neutral',
  accentColor: '',
  surface: 'inbox',
  autoDismissMs: null as number | null,
  actions: [] as { label: string; href: string }[],
  previewValues: {} as Record<string, string>,
}

describe('InAppPreview', () => {
  it('renders title with substituted {{.Name}} variable', () => {
    const { container } = render(
      <InAppPreview
        {...defaultProps}
        title="Hello {{.Name}}"
        previewValues={{ Name: 'World' }}
      />,
    )
    expect(container.textContent).toContain('Hello World')
    expect(container.textContent).not.toContain('{{.Name}}')
  })

  it('renders example values in formatted body markup', () => {
    const { container } = render(<InAppPreview {...defaultProps} body="<strong>Привіт, {{.Name}}</strong>" previewValues={{ Name: 'Олена' }} />)
    expect(container.querySelector('strong')).toHaveTextContent('Привіт, Олена')
    expect(container.textContent).not.toContain('{{.Name}}')
  })

  it('escapes sample values inside HTML like the backend renderer', () => {
    const { container } = render(<InAppPreview {...defaultProps} body="<strong>{{.Name}}</strong>" previewValues={{ Name: '<b>Alex</b>' }} />)
    expect(container.querySelector('strong')).toHaveTextContent('<b>Alex</b>')
    expect(container.querySelector('strong b')).toBeNull()
  })

  it('also substitutes bare {{Name}} syntax', () => {
    const { container } = render(
      <InAppPreview
        {...defaultProps}
        title="Dear {{User}}"
        previewValues={{ User: 'Alice' }}
      />,
    )
    expect(container.textContent).toContain('Dear Alice')
  })

  it('card border/outline style contains the accent color (data-accent attribute)', () => {
    const { container } = render(
      <InAppPreview
        {...defaultProps}
        accentColor="#AB1234"
        tone="neutral"
      />,
    )
    // data-accent preserves the hex verbatim (jsdom normalises CSS colours to rgb())
    const card = container.querySelector('[data-accent]')
    expect(card).not.toBeNull()
    expect(card!.getAttribute('data-accent')).toBe('#AB1234')
    expect((card as HTMLElement).style.borderLeft).toBe('')
    expect(card!.querySelector('span[aria-hidden="true"] svg')).not.toBeNull()
  })

  it('card uses toneColor when accentColor is empty (data-accent = danger hex)', () => {
    const { container } = render(
      <InAppPreview
        {...defaultProps}
        accentColor=""
        tone="danger"
      />,
    )
    const card = container.querySelector('[data-accent]')
    expect(card).not.toBeNull()
    expect(card!.getAttribute('data-accent')).toBe('#DC2626')
  })

  it('does not promise auto-hide for a legacy template', () => {
    const { container } = render(
      <InAppPreview
        {...defaultProps}
        autoDismissMs={5000}
      />,
    )
    expect(container.textContent).not.toContain('5s')
  })

  it('does NOT show auto-hide hint when autoDismissMs is null', () => {
    const { container } = render(
      <InAppPreview
        {...defaultProps}
        autoDismissMs={null}
      />,
    )
    // No "5s"-style string — just check the hint element is absent
    // (by verifying no element with "auto" text — we just confirm 5s absent)
    expect(container.textContent).not.toMatch(/\b5s\b/)
  })

  it('shows at most one optional action button', () => {
    const { container } = render(
      <InAppPreview
        {...defaultProps}
        actions={[
          { label: 'Click me', href: '/foo' },
          { label: 'Go here', href: '/bar' },
        ]}
      />,
    )
    const links = container.querySelectorAll('a[href="/foo"], a[href="/bar"]')
    expect(links.length).toBe(1)
  })

  it('renders action label text', () => {
    const { container } = render(
      <InAppPreview
        {...defaultProps}
        actions={[{ label: 'Open dashboard', href: '/dash' }]}
      />,
    )
    expect(container.textContent).toContain('Open dashboard')
  })

  it('sanitizes <script> in body (no raw <script> tag in output)', () => {
    const { container } = render(
      <InAppPreview
        {...defaultProps}
        body="<script>alert(1)</script>Safe text"
      />,
    )
    expect(container.innerHTML).not.toContain('<script>')
    expect(container.textContent).toContain('Safe text')
  })

  it('renders a link when link prop is non-empty', () => {
    const { container } = render(
      <InAppPreview
        {...defaultProps}
        link="https://example.com"
      />,
    )
    const anchor = container.querySelector('a[href="https://example.com"]')
    expect(anchor).not.toBeNull()
  })

  it('sanitizes javascript: scheme in link — renders safe href', () => {
    const { container } = render(
      <InAppPreview
        {...defaultProps}
        link="{{.Url}}"
        previewValues={{ Url: 'javascript:alert(1)' }}
      />,
    )
    // Link should be rendered with href="#" (safe), not javascript:
    const anchor = container.querySelector('a')
    expect(anchor).not.toBeNull()
    expect(anchor!.getAttribute('href')).toBe('#')
    expect(anchor!.getAttribute('href')).not.toContain('javascript:')
  })

  it('sanitizes javascript: scheme in action — renders safe href', () => {
    const { container } = render(
      <InAppPreview
        {...defaultProps}
        actions={[{ label: 'Click', href: 'javascript:alert(1)' }]}
      />,
    )
    // Action link should have href="#", not javascript:
    const actionLink = container.querySelector('a')
    expect(actionLink).not.toBeNull()
    expect(actionLink!.getAttribute('href')).toBe('#')
    expect(actionLink!.getAttribute('href')).not.toContain('javascript:')
  })

  it('preserves legitimate https: link and action URLs', () => {
    const { container } = render(
      <InAppPreview
        {...defaultProps}
        link="https://x.com"
        actions={[{ label: 'Visit', href: 'https://x.com' }]}
      />,
    )
    // Both should preserve the https URL
    const links = container.querySelectorAll('a[href="https://x.com"]')
    expect(links.length).toBe(2)
  })
})
