/**
 * page.test.tsx — Smoke test for the email block-template editor page.
 *
 * Covers:
 *  - Page mounts without throwing (getEmailTemplate called on load)
 *  - Subject VariableRichText renders with the fetched value
 *  - EmailPreview iframe renders
 *  - Save button is present for a draft template
 *  - Publish button is present for a draft template
 *  - Rollback button is present for a published template
 *  - Editor is read-only (body-readonly testid) for a published template
 *
 * Heavy components (BlockEditor, ColorPicker) are mocked — they each have their
 * own unit-test files and require browser APIs (Lexical / EyeDropper) absent in
 * jsdom.  VariableRichText is kept real because it works fine in jsdom.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react'
import type { EmailTemplate } from '@/api/notifications/emailTemplates'

// ── Module mocks (must be declared before any imports that trigger them) ──────

// i18n — return key as value so tests are language-agnostic
vi.mock('@/i18n/t', () => ({
  t: (key: string) => key,
}))

// next/navigation — provide a controllable useSearchParams
const mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

// API module
vi.mock('@/api/notifications/emailTemplates', () => ({
  getEmailTemplate:      vi.fn(),
  createEmailTemplate:   vi.fn(),
  updateEmailTemplate:   vi.fn(),
  publishEmailTemplate:  vi.fn(),
  rollbackEmailTemplate: vi.fn(),
  listBlockPresets:      vi.fn(),
  listEmailTemplates:    vi.fn(),
  createBlockPreset:     vi.fn(),
  previewEmailTemplate:  vi.fn(() => new Promise(() => {})),
}))

// templateTypes hook
vi.mock('@/components/notifications/templateTypes', () => ({
  useNotificationTypes: () => [
    {
      Type: 'user.welcome',
      Channels: ['email'],
      Variables: [{ Name: 'name', Description: 'User name', Default: 'Alice' }],
    },
  ],
}))

vi.mock('@/components/ui/select-menu', () => ({
  SelectMenu: ({ value, onChange, options, placeholder }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; placeholder: string }) => (
    <select aria-label={placeholder} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}))

// useRole — grant all permissions so RequirePermission passes
vi.mock('@/lib/useRole', () => ({
  useRole: () => ({
    me: null,
    role: 'super_admin',
    isLoading: false,
    permissions: ['*'],
    can: () => true,
  }),
}))

// BlockEditor — avoid Lexical + canvas dependencies
vi.mock('@/components/notifications/editor/BlockEditor', () => ({
  BlockEditor: ({ value }: { value: unknown[] }) => (
    <div data-testid="block-editor">blocks: {value.length}</div>
  ),
  default: ({ value }: { value: unknown[] }) => (
    <div data-testid="block-editor">blocks: {value.length}</div>
  ),
}))

// ColorPicker — avoid EyeDropper / canvas
vi.mock('@/components/notifications/editor/ColorPicker', () => ({
  ColorPicker: ({ label, value }: { label?: string; value: string }) => (
    <div data-testid={`color-picker-${label ?? 'unknown'}`}>{value}</div>
  ),
  default: ({ label, value }: { label?: string; value: string }) => (
    <div data-testid={`color-picker-${label ?? 'unknown'}`}>{value}</div>
  ),
}))

// TestNotificationModal — expose props as data attributes so tests can assert them
vi.mock('@/components/notifications/editor/TestNotificationModal', () => ({
  TestNotificationModal: ({
    open,
    notificationType,
    templateId,
  }: {
    open: boolean
    notificationType: string
    templateId?: string
  }) =>
    open ? (
      <div
        data-testid="test-notification-modal"
        data-notification-type={notificationType}
        data-template-id={templateId ?? ""}
      />
    ) : null,
}))

// ── Import the API mocks so we can configure them per-test ────────────────────
import {
  getEmailTemplate,
  createEmailTemplate,
  updateEmailTemplate,
  rollbackEmailTemplate,
  listBlockPresets,
  listEmailTemplates,
} from '@/api/notifications/emailTemplates'

// ── Import component AFTER all mocks ──────────────────────────────────────────
import Page from './page'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeDraftTemplate(overrides?: Partial<EmailTemplate>): EmailTemplate {
  return {
    ID:               'tpl-001',
    NotificationType: 'user.welcome',
    Status:           'draft',
    Subject:          'Welcome {{.name}}',
    Preheader:        'We are glad you joined',
    Body:             [],
    Styling:          { cta_bg_color: '#0070f3', cta_text_color: '#ffffff' },
    PublishedAt:      null,
    UpdatedByUserID:  null,
    CreatedAt:        '2024-01-01T00:00:00Z',
    UpdatedAt:        '2024-01-02T00:00:00Z',
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Email template editor page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: point at a known template id
    mockSearchParams.set('id', 'tpl-001')
    mockSearchParams.delete('type')
    // Default API responses
    vi.mocked(getEmailTemplate).mockResolvedValue(makeDraftTemplate())
    vi.mocked(listBlockPresets).mockResolvedValue([])
    vi.mocked(listEmailTemplates).mockResolvedValue({ Templates: [makeDraftTemplate()], MissingActiveFor: [] })
  })

  // ── Smoke ─────────────────────────────────────────────────────────────────

  it('renders without throwing', () => {
    expect(() => render(<Page />)).not.toThrow()
  })

  it('calls getEmailTemplate with the id from the search params', async () => {
    render(<Page />)
    await waitFor(() => {
      expect(getEmailTemplate).toHaveBeenCalledWith('tpl-001')
    })
  })

  it('does not show an older template when its request finishes after navigation', async () => {
    let resolveFirst!: (value: EmailTemplate) => void
    vi.mocked(getEmailTemplate).mockImplementation((id) => id === 'tpl-001'
      ? new Promise<EmailTemplate>((resolve) => { resolveFirst = resolve })
      : Promise.resolve(makeDraftTemplate({ ID: 'tpl-002', Subject: 'Second subject' })))
    const view = render(<Page />)
    await waitFor(() => expect(getEmailTemplate).toHaveBeenCalledWith('tpl-001'))
    mockSearchParams.set('id', 'tpl-002')
    view.rerender(<Page />)
    await waitFor(() => expect(getEmailTemplate).toHaveBeenCalledWith('tpl-002'))
    await waitFor(() => expect(screen.getAllByRole('textbox')[0]).toHaveTextContent('Second subject'))
    await act(async () => { resolveFirst(makeDraftTemplate({ Subject: 'Stale subject' })) })
    expect(screen.getAllByRole('textbox')[0]).toHaveTextContent('Second subject')
  })

  // ── Subject field ─────────────────────────────────────────────────────────

  it('renders the subject field with the fetched template subject value', async () => {
    render(<Page />)
    // VariableRichText renders a [role=textbox]; subject is shown via contentEditable
    await waitFor(() => {
      const textboxes = screen.getAllByRole('textbox')
      expect(textboxes.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ── EmailPreview iframe ───────────────────────────────────────────────────

  it('renders an EmailPreview iframe', async () => {
    render(<Page />)
    await waitFor(() => {
      const iframes = document.querySelectorAll('iframe')
      expect(iframes.length).toBeGreaterThan(0)
    })
  })

  // ── Action buttons (draft) ────────────────────────────────────────────────

  it('shows Save and Publish buttons for a draft template', async () => {
    render(<Page />)
    // t() is mocked to return the key; buttons show "admin.notif.tpl.save" etc.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'admin.notif.tpl.save' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'admin.notif.tpl.publish' })).toBeInTheDocument()
    })
  })

  it('highlights Save for local edits and offers Publish only after they are saved', async () => {
    vi.mocked(updateEmailTemplate).mockResolvedValue(makeDraftTemplate({ Styling: {
      cta_bg_color: '#0070f3', cta_text_color: '#ffffff', cta_border_radius: '6px',
    } }))
    render(<Page />)
    const radius = await screen.findByLabelText('admin.notif.editor.ctaBorderRadius')
    const save = screen.getByRole('button', { name: 'admin.notif.tpl.save' })
    expect(save).toBeDisabled()
    expect(screen.getByRole('button', { name: 'admin.notif.tpl.publish' })).toBeInTheDocument()

    fireEvent.change(radius, { target: { value: '6' } })
    expect(save).toBeEnabled()
    expect(save).toHaveClass('bg-primary')
    expect(screen.queryByRole('button', { name: 'admin.notif.tpl.publish' })).not.toBeInTheDocument()

    fireEvent.click(save)
    await waitFor(() => expect(screen.getByRole('button', { name: 'admin.notif.tpl.publish' })).toBeInTheDocument())
    expect(save).toBeDisabled()
  })

  it('does NOT show Rollback button for a draft template', async () => {
    render(<Page />)
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'admin.notif.tpl.rollback' }),
      ).not.toBeInTheDocument()
    })
  })

  // ── Published state ───────────────────────────────────────────────────────

  it('shows restore button and read-only body for an unpublished template', async () => {
    vi.mocked(getEmailTemplate).mockResolvedValue(
      makeDraftTemplate({ Status: 'unpublished' }),
    )
    render(<Page />)
    vi.mocked(listEmailTemplates).mockResolvedValue({ Templates: [makeDraftTemplate({ Status: 'unpublished' })], MissingActiveFor: [] })
    await waitFor(() => {
      expect(screen.getByTestId('body-readonly')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'admin.notif.versions.title' }))
    expect(await screen.findByRole('button', { name: 'admin.notif.tpl.rollback' })).toBeInTheDocument()
  })

  it('does NOT show Save or Publish buttons for a published template', async () => {
    vi.mocked(getEmailTemplate).mockResolvedValue(
      makeDraftTemplate({ Status: 'published' }),
    )
    render(<Page />)
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'admin.notif.tpl.save' }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'admin.notif.tpl.publish' }),
      ).not.toBeInTheDocument()
    })
  })

  // ── New template (no id) ──────────────────────────────────────────────────

  it('renders blank form (no getEmailTemplate call) when id is empty', async () => {
    mockSearchParams.delete('id')
    render(<Page />)
    // Should not call getEmailTemplate for new templates
    await new Promise((r) => setTimeout(r, 50))
    expect(getEmailTemplate).not.toHaveBeenCalled()
    expect(screen.getByRole('combobox', { name: 'admin.notif.tpl.choose' })).toBeInTheDocument()
  })

  // ── Double-create prevention ───────────────────────────────────────────────

  it('calls updateEmailTemplate (not a second createEmailTemplate) on second Save after new-template create', async () => {
    mockSearchParams.delete('id')
    const createdTpl = makeDraftTemplate({ ID: 'tpl-new', Subject: '', Preheader: '', Styling: {} })
    vi.mocked(createEmailTemplate).mockResolvedValue(createdTpl)
    vi.mocked(updateEmailTemplate).mockResolvedValue({ ...createdTpl, Styling: { cta_border_radius: '6px' } })

    render(<Page />)

    // Wait for blank new-template form, then select a notification type.
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'admin.notif.tpl.choose' })).toBeInTheDocument()
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'admin.notif.tpl.choose' }), { target: { value: 'user.welcome' } })

    // First Save → createEmailTemplate
    fireEvent.click(screen.getByRole('button', { name: 'admin.notif.tpl.save' }))

    await waitFor(() => {
      expect(createEmailTemplate).toHaveBeenCalledTimes(1)
    })

    // The button is renamed while busy; wait for the create request to settle.
    const save = await screen.findByRole('button', { name: 'admin.notif.tpl.save' })
    await waitFor(() => expect(save).toBeDisabled())
    fireEvent.change(screen.getByLabelText('admin.notif.editor.ctaBorderRadius'), { target: { value: '6' } })
    fireEvent.click(save)

    await waitFor(() => {
      expect(updateEmailTemplate).toHaveBeenCalledTimes(1)
    })
    expect(createEmailTemplate).toHaveBeenCalledTimes(1)
  })

  // ── inert read-only wrappers ───────────────────────────────────────────────

  it('adds inert attribute to Subject and Preheader wrappers when template is published', async () => {
    vi.mocked(getEmailTemplate).mockResolvedValue(
      makeDraftTemplate({ Status: 'published' }),
    )
    render(<Page />)

    await waitFor(() => {
      const subjectWrapper = document.querySelector('[data-testid="subject-wrapper"]')
      const preheaderWrapper = document.querySelector('[data-testid="preheader-wrapper"]')
      expect(subjectWrapper).not.toBeNull()
      expect(preheaderWrapper).not.toBeNull()
      expect(subjectWrapper).toHaveAttribute('inert')
      expect(preheaderWrapper).toHaveAttribute('inert')
    })
  })

  it('does NOT add inert attribute to Subject wrapper when template is a draft', async () => {
    render(<Page />)

    await waitFor(() => {
      const subjectWrapper = document.querySelector('[data-testid="subject-wrapper"]')
      expect(subjectWrapper).not.toBeNull()
      expect(subjectWrapper).not.toHaveAttribute('inert')
    })
  })

  // ── Send test button + modal ──────────────────────────────────────────────

  it('shows a Send test button when a template is loaded', async () => {
    render(<Page />)
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'admin.notif.test.button' }),
      ).toBeInTheDocument()
    })
  })

  it('opens TestNotificationModal with correct notificationType and templateId on Send test click', async () => {
    render(<Page />)

    // Wait for template to load and Send test button to appear
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'admin.notif.test.button' }),
      ).toBeInTheDocument()
    })

    // Click the button
    fireEvent.click(screen.getByRole('button', { name: 'admin.notif.test.button' }))

    // Assert modal rendered with correct props from the loaded template fixture
    await waitFor(() => {
      const modal = screen.getByTestId('test-notification-modal')
      expect(modal).toBeInTheDocument()
      expect(modal).toHaveAttribute('data-notification-type', 'user.welcome')
      expect(modal).toHaveAttribute('data-template-id', 'tpl-001')
    })
  })

  // ── Rollback re-renders editors ───────────────────────────────────────────

  it('re-renders BlockEditor with rolled-back content after Rollback', async () => {
    // Start with an unpublished template (body-readonly shown, no BlockEditor)
    vi.mocked(getEmailTemplate).mockResolvedValue(
      makeDraftTemplate({ Status: 'unpublished' }),
    )
    // Rollback returns a draft template so editors become editable again
    vi.mocked(rollbackEmailTemplate).mockResolvedValue(
      makeDraftTemplate({ Status: 'draft', Body: [] }),
    )
    vi.mocked(listEmailTemplates).mockResolvedValue({ Templates: [makeDraftTemplate({ Status: 'unpublished' })], MissingActiveFor: [] })

    render(<Page />)

    // Archived state: body-readonly shown, BlockEditor NOT rendered
    await waitFor(() => {
      expect(screen.getByTestId('body-readonly')).toBeInTheDocument()
      expect(screen.queryByTestId('block-editor')).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'admin.notif.versions.title' }))
    fireEvent.click(await screen.findByRole('button', { name: 'admin.notif.tpl.rollback' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'admin.notif.tpl.rollback' }))

    // After rollback to draft: BlockEditor appears with rolled-back block count (0)
    await waitFor(() => {
      expect(screen.queryByTestId('body-readonly')).not.toBeInTheDocument()
      const editor = screen.getByTestId('block-editor')
      expect(editor).toBeInTheDocument()
      expect(editor).toHaveTextContent('blocks: 0')
    })
  })

  it('can restore the published email version over a draft without publishing it', async () => {
    const published = makeDraftTemplate({ ID: 'tpl-published', Status: 'published', Subject: 'Live subject' })
    vi.mocked(listEmailTemplates).mockResolvedValue({ Templates: [makeDraftTemplate(), published], MissingActiveFor: [] })
    vi.mocked(rollbackEmailTemplate).mockResolvedValue(makeDraftTemplate({ Subject: 'Live subject' }))
    render(<Page />)
    fireEvent.click(await screen.findByRole('button', { name: 'admin.notif.versions.title' }))
    fireEvent.click(await screen.findByRole('button', { name: 'admin.notif.tpl.rollback' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'admin.notif.tpl.rollback' }))
    await waitFor(() => expect(rollbackEmailTemplate).toHaveBeenCalledWith('tpl-published'))
    expect(screen.getByRole('button', { name: 'admin.notif.tpl.publish' })).toBeInTheDocument()
  })

  // ── Translated status in read-only banner ─────────────────────────────────

  it('shows translated status and a read-only body hint for a published template', async () => {
    vi.mocked(getEmailTemplate).mockResolvedValue(
      makeDraftTemplate({ Status: 'published' }),
    )
    render(<Page />)

    await waitFor(() => {
      const banner = screen.getByTestId('body-readonly')
      expect(banner).toHaveTextContent('admin.notif.tpl.readonlyHint')
      expect(screen.getByText('admin.notif.status.published')).toBeInTheDocument()
    })
  })

  it('puts the read-only notice at the top as a warning, outside the body section, and none on a draft', async () => {
    vi.mocked(getEmailTemplate).mockResolvedValue(makeDraftTemplate({ Status: 'published' }))
    const { unmount } = render(<Page />)
    const notice = await screen.findByTestId('body-readonly')
    expect(notice.className).toContain('--ib-warn-bg')
    expect(notice.className).not.toMatch(/border-l|shadow/)
    expect(notice.compareDocumentPosition(screen.getByTestId('subject-wrapper')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByText('admin.notif.tpl.body')).not.toBeInTheDocument()
    unmount()

    vi.mocked(getEmailTemplate).mockResolvedValue(makeDraftTemplate({ Status: 'draft' }))
    render(<Page />)
    await screen.findByText('admin.notif.tpl.body')
    expect(screen.queryByTestId('body-readonly')).not.toBeInTheDocument()
  })

  // ── Styling px unit fix ───────────────────────────────────────────────────

  it('stores cta_border_radius and cta_font_size with px suffix when edited', async () => {
    vi.mocked(updateEmailTemplate).mockResolvedValue(makeDraftTemplate())
    render(<Page />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'admin.notif.tpl.save' })).toBeInTheDocument()
    })

    // Find the border-radius input and change it
    const borderRadiusInput = screen.getByLabelText('admin.notif.editor.ctaBorderRadius')
    fireEvent.change(borderRadiusInput, { target: { value: '6' } })

    // Find the font-size input and change it
    const fontSizeInput = screen.getByLabelText('admin.notif.editor.ctaFontSize')
    fireEvent.change(fontSizeInput, { target: { value: '18' } })

    // Click Save
    fireEvent.click(screen.getByRole('button', { name: 'admin.notif.tpl.save' }))

    // Verify updateEmailTemplate was called with px-suffixed values
    await waitFor(() => {
      expect(updateEmailTemplate).toHaveBeenCalledWith(
        'tpl-001',
        expect.objectContaining({
          Styling: expect.objectContaining({
            cta_border_radius: '6px',
            cta_font_size: '18px',
          }),
        }),
      )
    })
  })
})
