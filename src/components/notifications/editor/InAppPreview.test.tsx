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

  it('shows auto-hide hint when autoDismissMs=5000', () => {
    const { container } = render(
      <InAppPreview
        {...defaultProps}
        autoDismissMs={5000}
      />,
    )
    // The hint includes the seconds value
    expect(container.textContent).toContain('5')
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

  it('renders one button/link per action', () => {
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
    expect(links.length).toBe(2)
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
})
