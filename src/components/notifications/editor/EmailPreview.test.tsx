/**
 * EmailPreview.test.tsx — the preview is rendered by the backend
 * (previewEmailTemplate). EmailPreview debounces the draft fields (300 ms),
 * renders the returned HTML in a fully sandboxed iframe srcDoc (images arrive
 * inline as data: URIs, so the frame needs no origin or cookies), keeps
 * the last good HTML while a new render is in flight or has failed, and shows
 * render errors inline.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import type { EmailBodyBlock } from './emailBlocks'

vi.mock('@/lib/origins', () => ({
  eventDomain: 'example.test',
  apiOrigin: 'https://api.example.test',
  mainOrigin: 'https://example.test',
  idOrigin: 'https://id.example.test',
}))

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

const preview = vi.fn()
vi.mock('@/api/notifications/emailTemplates', () => ({
  previewEmailTemplate: (...args: unknown[]) => preview(...args),
}))

import { ApiError } from '@/api/client'
import { EmailPreview } from './EmailPreview'

const body: EmailBodyBlock[] = [{ type: 'divider' }]
const styling = { cta_bg_color: 'theme:accent' }

function srcDoc(): string {
  return document.querySelector('iframe')?.getAttribute('srcdoc') ?? ''
}

async function flushDebounce() {
  await act(async () => { await vi.advanceTimersByTimeAsync(300) })
}

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('EmailPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    preview.mockReset()
    preview.mockResolvedValue({ Subject: 'Hi Ada', Preheader: 'Welcome Ada', HTML: '<p>Hello Ada</p>' })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls previewEmailTemplate once, 300 ms after the last change, with the current fields', async () => {
    const { rerender } = render(
      <EmailPreview notificationType="user.welcome" subject="Hi" preheader="P" body={body} styling={styling} />,
    )
    await act(async () => { await vi.advanceTimersByTimeAsync(200) })
    rerender(<EmailPreview notificationType="user.welcome" subject="Hi {{.Name}}" preheader="P" body={body} styling={styling} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(299) })
    expect(preview).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(preview).toHaveBeenCalledTimes(1)
    expect(preview).toHaveBeenCalledWith({
      NotificationType: 'user.welcome',
      Subject: 'Hi {{.Name}}',
      Preheader: 'P',
      Body: body,
      Styling: styling,
    }, expect.any(AbortSignal))
  })

  it('does not call the backend without a notification type', async () => {
    render(<EmailPreview notificationType="" subject="Hi" preheader="" body={body} styling={styling} />)
    await flushDebounce()
    expect(preview).not.toHaveBeenCalled()
  })

  it('clears the previous render and error when the notification type becomes empty', async () => {
    const { rerender } = render(
      <EmailPreview notificationType="user.welcome" subject="Hi" preheader="" body={body} styling={styling} />,
    )
    await flushDebounce()
    expect(srcDoc()).toContain('<p>Hello Ada</p>')
    preview.mockRejectedValueOnce(new ApiError(400, null, 'bad draft'))
    rerender(<EmailPreview notificationType="user.welcome" subject="Hi {{.x" preheader="" body={body} styling={styling} />)
    await flushDebounce()
    expect(screen.getByRole('alert').textContent).toBe('bad draft')

    rerender(<EmailPreview notificationType="" subject="Hi {{.x" preheader="" body={body} styling={styling} />)
    await flushDebounce()
    expect(srcDoc()).not.toContain('Hello Ada')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(document.body.textContent).not.toContain('Hi Ada')
    expect(preview).toHaveBeenCalledTimes(2)
  })

  it('renders the returned HTML in a sandboxed iframe srcDoc with a title', async () => {
    render(<EmailPreview notificationType="user.welcome" subject="Hi" preheader="" body={body} styling={styling} />)
    await flushDebounce()
    const iframe = document.querySelector('iframe')
    expect(iframe).not.toBeNull()
    // Fully isolated: images are inline data: URIs, so the frame needs no
    // origin, cookies or scripts.
    expect(iframe!.getAttribute('sandbox')).toBe('')
    expect(iframe!.getAttribute('title')).toBe('admin.notif.editor.previewTitle')
    expect(srcDoc().toLowerCase()).toContain('<!doctype html>')
    expect(srcDoc()).toContain('<p>Hello Ada</p>')
  })

  it('passes inline data: images through without injecting a <base href>', async () => {
    const img = '<img src="data:image/png;base64,iVBORw0KGgo="/>'
    preview.mockResolvedValue({ Subject: '', Preheader: '', HTML: img })
    render(<EmailPreview notificationType="user.welcome" subject="" preheader="" body={body} styling={styling} />)
    await flushDebounce()
    const doc = srcDoc()
    expect(doc).toContain(img)
    expect(doc).not.toContain('<base')
    expect(doc).not.toContain('api.example.test')
  })

  it('shows the backend-rendered subject and preheader above the body', async () => {
    render(<EmailPreview notificationType="user.welcome" subject="Hi {{.Name}}" preheader="For {{.Name}}" body={body} styling={styling} />)
    await flushDebounce()
    expect(document.body.textContent).toContain('Hi Ada')
    expect(document.body.textContent).toContain('Welcome Ada')
  })

  it('keeps showing the previous HTML while the next render is loading', async () => {
    const { rerender } = render(
      <EmailPreview notificationType="user.welcome" subject="A" preheader="" body={body} styling={styling} />,
    )
    await flushDebounce()
    expect(srcDoc()).toContain('<p>Hello Ada</p>')

    const pending = deferred<{ Subject: string; Preheader: string; HTML: string }>()
    preview.mockReturnValue(pending.promise)
    rerender(<EmailPreview notificationType="user.welcome" subject="B" preheader="" body={body} styling={styling} />)
    await flushDebounce()
    expect(preview).toHaveBeenCalledTimes(2)
    expect(srcDoc()).toContain('<p>Hello Ada</p>')

    await act(async () => { pending.resolve({ Subject: 'B', Preheader: '', HTML: '<p>Second</p>' }) })
    expect(srcDoc()).toContain('<p>Second</p>')
  })

  it('ignores a stale response that resolves after a newer one', async () => {
    const first = deferred<{ Subject: string; Preheader: string; HTML: string }>()
    preview.mockReturnValueOnce(first.promise)
    const { rerender } = render(
      <EmailPreview notificationType="user.welcome" subject="A" preheader="" body={body} styling={styling} />,
    )
    await flushDebounce()
    preview.mockResolvedValueOnce({ Subject: 'B', Preheader: '', HTML: '<p>Newer</p>' })
    rerender(<EmailPreview notificationType="user.welcome" subject="B" preheader="" body={body} styling={styling} />)
    await flushDebounce()
    expect(srcDoc()).toContain('<p>Newer</p>')
    await act(async () => { first.resolve({ Subject: 'A', Preheader: '', HTML: '<p>Stale</p>' }) })
    expect(srcDoc()).toContain('<p>Newer</p>')
    expect(srcDoc()).not.toContain('Stale')
  })

  it('on a 400 render error keeps the last good HTML and shows the backend message inline', async () => {
    const { rerender } = render(
      <EmailPreview notificationType="user.welcome" subject="A" preheader="" body={body} styling={styling} />,
    )
    await flushDebounce()
    preview.mockRejectedValue(new ApiError(400, null, 'Template cannot be rendered: unclosed action'))
    rerender(<EmailPreview notificationType="user.welcome" subject="{{.us" preheader="" body={body} styling={styling} />)
    await flushDebounce()
    expect(screen.getByRole('alert').textContent).toContain('Template cannot be rendered: unclosed action')
    expect(srcDoc()).toContain('<p>Hello Ada</p>')

    // A later good render clears the error.
    preview.mockResolvedValue({ Subject: 'C', Preheader: '', HTML: '<p>Fixed</p>' })
    rerender(<EmailPreview notificationType="user.welcome" subject="{{.user_first_name}}" preheader="" body={body} styling={styling} />)
    await flushDebounce()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(srcDoc()).toContain('<p>Fixed</p>')
  })

  it('shows a generic inline error for non-400 failures', async () => {
    preview.mockRejectedValue(new ApiError(500, null, 'Failed to render template'))
    render(<EmailPreview notificationType="user.welcome" subject="A" preheader="" body={body} styling={styling} />)
    await flushDebounce()
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('admin.notif.editor.previewError')
    expect(alert.textContent).not.toContain('Failed to render template')
    expect(document.querySelector('iframe')).not.toBeNull()
  })

  it('aborts a superseded in-flight request when the fields change', async () => {
    preview.mockReturnValueOnce(new Promise(() => {}))
    const { rerender } = render(
      <EmailPreview notificationType="user.welcome" subject="A" preheader="" body={body} styling={styling} />,
    )
    await flushDebounce()
    const firstSignal = preview.mock.calls[0][1] as AbortSignal
    expect(firstSignal.aborted).toBe(false)
    rerender(<EmailPreview notificationType="user.welcome" subject="B" preheader="" body={body} styling={styling} />)
    expect(firstSignal.aborted).toBe(true)
  })

  it('unmounting during a pending request aborts it and causes no state update or warning', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const pending = deferred<{ Subject: string; Preheader: string; HTML: string }>()
    preview.mockReturnValue(pending.promise)
    const { unmount } = render(
      <EmailPreview notificationType="user.welcome" subject="A" preheader="" body={body} styling={styling} />,
    )
    await flushDebounce()
    const signal = preview.mock.calls[0][1] as AbortSignal
    unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => { pending.resolve({ Subject: 'late', Preheader: '', HTML: '<p>late</p>' }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
