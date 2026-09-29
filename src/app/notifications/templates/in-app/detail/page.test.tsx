/**
 * page.test.tsx — Smoke test for the in-app notification template editor page.
 *
 * Covers:
 *  - Page mounts without throwing (getInAppTemplate called on load)
 *  - Title VariableRichText renders (textbox present after load)
 *  - Icon / Tone / Surface selects render with the fetched values
 *  - InAppPreview receives loaded icon / tone (mocked, data-tested)
 *  - Save button is present for a draft template
 *  - Publish button is present for a draft template
 *  - Rollback button is present for a published template
 *  - Read-only (inert wrapper) for a published template
 *  - Send-test button opens TestNotificationModal with channels=["in_app"] + notificationType + templateId
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react'
import type { InAppTemplate } from '@/api/notifications/inAppTemplates'

// ── Module mocks ──────────────────────────────────────────────────────────────

// i18n — return key as value so tests are language-agnostic
vi.mock('@/i18n/t', () => ({
  t: (key: string) => key,
}))

// next/navigation
const mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

// In-app template API
vi.mock('@/api/notifications/inAppTemplates', () => ({
  getInAppTemplate:      vi.fn(),
  createInAppTemplate:   vi.fn(),
  updateInAppTemplate:   vi.fn(),
  publishInAppTemplate:  vi.fn(),
  rollbackInAppTemplate: vi.fn(),
  listInAppTemplates:     vi.fn(),
}))

// templateTypes hook
vi.mock('@/components/notifications/templateTypes', () => ({
  useNotificationTypes: () => [
    {
      Type: 'user.welcome',
      Channels: ['in_app'],
      Variables: [{ Name: 'name', Description: 'User name', Default: 'Alice' }],
    },
  ],
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

// InAppPreview — expose props as data attributes for easy assertion
vi.mock('@/components/notifications/editor/InAppPreview', () => ({
  InAppPreview: ({
    title,
    icon,
    tone,
    surface,
  }: {
    title: string
    icon: string
    tone: string
    surface: string
  }) => (
    <div
      data-testid="in-app-preview"
      data-title={title}
      data-icon={icon}
      data-tone={tone}
      data-surface={surface}
    />
  ),
  default: ({
    title,
    icon,
    tone,
    surface,
  }: {
    title: string
    icon: string
    tone: string
    surface: string
  }) => (
    <div
      data-testid="in-app-preview"
      data-title={title}
      data-icon={icon}
      data-tone={tone}
      data-surface={surface}
    />
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

// TestNotificationModal — expose props as data attributes
vi.mock('@/components/notifications/editor/TestNotificationModal', () => ({
  TestNotificationModal: ({
    open,
    notificationType,
    channels,
    templateId,
  }: {
    open: boolean
    notificationType: string
    channels: string[]
    templateId?: string
  }) =>
    open ? (
      <div
        data-testid="test-notification-modal"
        data-notification-type={notificationType}
        data-channels={JSON.stringify(channels)}
        data-template-id={templateId ?? ''}
      />
    ) : null,
}))

// ── API mock imports ──────────────────────────────────────────────────────────
import {
  getInAppTemplate,
  createInAppTemplate,
  updateInAppTemplate,
  rollbackInAppTemplate,
  listInAppTemplates,
} from '@/api/notifications/inAppTemplates'

// ── Import component AFTER all mocks ─────────────────────────────────────────
import Page from './page'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeDraftTemplate(overrides?: Partial<InAppTemplate>): InAppTemplate {
  return {
    ID:               'tpl-001',
    NotificationType: 'user.welcome',
    Status:           'draft',
    Title:            'Hello {{.name}}',
    Body:             'Welcome to the platform.',
    Link:             '',
    Icon:             'info',
    Tone:             'info',
    AccentColor:      '',
    Surface:          'inbox',
    AutoDismissMs:    null,
    Dismissible:      true,
    Actions:          [],
    PublishedAt:      null,
    UpdatedByUserID:  null,
    CreatedAt:        '2024-01-01T00:00:00Z',
    UpdatedAt:        '2024-01-02T00:00:00Z',
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('In-app template editor page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.set('id', 'tpl-001')
    mockSearchParams.delete('type')
    vi.mocked(getInAppTemplate).mockResolvedValue(makeDraftTemplate())
    vi.mocked(listInAppTemplates).mockResolvedValue({ Templates: [makeDraftTemplate()], MissingActiveFor: [] })
  })

  // ── Smoke ─────────────────────────────────────────────────────────────────

  it('renders without throwing', () => {
    expect(() => render(<Page />)).not.toThrow()
  })

  it('calls getInAppTemplate with the id from search params', async () => {
    render(<Page />)
    await waitFor(() => {
      expect(getInAppTemplate).toHaveBeenCalledWith('tpl-001')
    })
  })

  it('does not show an older template when its request finishes after navigation', async () => {
    let resolveFirst!: (value: InAppTemplate) => void
    vi.mocked(getInAppTemplate).mockImplementation((id) => id === 'tpl-001'
      ? new Promise<InAppTemplate>((resolve) => { resolveFirst = resolve })
      : Promise.resolve(makeDraftTemplate({ ID: 'tpl-002', Title: 'Second title' })))
    const view = render(<Page />)
    await waitFor(() => expect(getInAppTemplate).toHaveBeenCalledWith('tpl-001'))
    mockSearchParams.set('id', 'tpl-002')
    view.rerender(<Page />)
    await waitFor(() => expect(getInAppTemplate).toHaveBeenCalledWith('tpl-002'))
    await waitFor(() => expect(screen.getByTestId('in-app-preview')).toHaveAttribute('data-title', 'Second title'))
    await act(async () => { resolveFirst(makeDraftTemplate({ Title: 'Stale title' })) })
    expect(screen.getByTestId('in-app-preview')).toHaveAttribute('data-title', 'Second title')
  })

  // ── Fields ────────────────────────────────────────────────────────────────

  it('renders the Title VariableRichText (textbox) after load', async () => {
    render(<Page />)
    await waitFor(() => {
      const textboxes = screen.getAllByRole('textbox')
      expect(textboxes.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('renders a unified appearance picker after load', async () => {
    render(<Page />)
    await waitFor(() => {
      expect(screen.getByRole('radiogroup', { name: 'admin.notif.inapp.appearance' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /admin.notif.inapp.appearanceMore/ })).toBeInTheDocument()
    })
  })

  it('saves the configured pop-up duration in milliseconds', async () => {
    vi.mocked(updateInAppTemplate).mockResolvedValue(makeDraftTemplate({ AutoDismissMs: 7500 }))
    render(<Page />)
    const duration = await screen.findByLabelText('admin.notif.inapp.autoDismissMs')
    fireEvent.change(duration, { target: { value: '7.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'admin.notif.tpl.save' }))
    await waitFor(() => expect(updateInAppTemplate).toHaveBeenCalledWith('tpl-001', expect.objectContaining({ AutoDismissMs: 7500 })))
  })

  it('highlights Save for local edits and offers Publish only after they are saved', async () => {
    vi.mocked(updateInAppTemplate).mockResolvedValue(makeDraftTemplate({ AutoDismissMs: 7500 }))
    render(<Page />)
    const duration = await screen.findByLabelText('admin.notif.inapp.autoDismissMs')
    const save = screen.getByRole('button', { name: 'admin.notif.tpl.save' })
    expect(save).toBeDisabled()
    expect(screen.getByRole('button', { name: 'admin.notif.tpl.publish' })).toBeInTheDocument()

    fireEvent.change(duration, { target: { value: '7.5' } })
    expect(save).toBeEnabled()
    expect(save).toHaveClass('bg-primary')
    expect(screen.queryByRole('button', { name: 'admin.notif.tpl.publish' })).not.toBeInTheDocument()

    fireEvent.click(save)
    await waitFor(() => expect(screen.getByRole('button', { name: 'admin.notif.tpl.publish' })).toBeInTheDocument())
    expect(save).toBeDisabled()
  })

  it('shows field descriptions only through the question icon', async () => {
    render(<Page />)
    await screen.findByLabelText('admin.notif.inapp.autoDismissMs')
    expect(screen.queryByText('admin.notif.inapp.linkHelp')).not.toBeInTheDocument()
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'admin.notif.inapp.linkHelp' }))
    expect(screen.getByRole('tooltip')).toHaveTextContent('admin.notif.inapp.linkHelp')
  })

  // ── InAppPreview receives loaded values ───────────────────────────────────

  it('passes loaded icon and tone to InAppPreview', async () => {
    render(<Page />)
    await waitFor(() => {
      const preview = screen.getByTestId('in-app-preview')
      expect(preview).toHaveAttribute('data-icon', 'info')
      expect(preview).toHaveAttribute('data-tone', 'info')
    })
  })

  // ── Action buttons (draft) ────────────────────────────────────────────────

  it('shows Save and Publish buttons for a draft template', async () => {
    render(<Page />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'admin.notif.tpl.save' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'admin.notif.tpl.publish' })).toBeInTheDocument()
    })
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

  it('shows restore button for an unpublished template', async () => {
    vi.mocked(getInAppTemplate).mockResolvedValue(
      makeDraftTemplate({ Status: 'unpublished' }),
    )
    render(<Page />)
    vi.mocked(listInAppTemplates).mockResolvedValue({ Templates: [makeDraftTemplate({ Status: 'unpublished' })], MissingActiveFor: [] })
    fireEvent.click(await screen.findByRole('button', { name: 'admin.notif.versions.title' }))
    expect(await screen.findByRole('button', { name: 'admin.notif.tpl.rollback' })).toBeInTheDocument()
  })

  it('does NOT show Save or Publish buttons for a published template', async () => {
    vi.mocked(getInAppTemplate).mockResolvedValue(
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

  // ── Read-only inert wrapper ───────────────────────────────────────────────

  it('adds inert attribute to fields-wrapper when template is published', async () => {
    vi.mocked(getInAppTemplate).mockResolvedValue(
      makeDraftTemplate({ Status: 'published' }),
    )
    render(<Page />)
    await waitFor(() => {
      const wrapper = document.querySelector('[data-testid="fields-wrapper"]')
      expect(wrapper).not.toBeNull()
      expect(wrapper).toHaveAttribute('inert')
    })
  })

  it('does NOT add inert to fields-wrapper when template is a draft', async () => {
    render(<Page />)
    await waitFor(() => {
      const wrapper = document.querySelector('[data-testid="fields-wrapper"]')
      expect(wrapper).not.toBeNull()
      expect(wrapper).not.toHaveAttribute('inert')
    })
  })

  it('shows the orange read-only notice only for a published template', async () => {
    vi.mocked(getInAppTemplate).mockResolvedValue(makeDraftTemplate({ Status: 'published' }))
    const { unmount } = render(<Page />)
    expect(await screen.findByTestId('body-readonly')).toHaveTextContent('admin.notif.tpl.readonlyHint')
    unmount()
    vi.mocked(getInAppTemplate).mockResolvedValue(makeDraftTemplate({ Status: 'draft' }))
    render(<Page />)
    await waitFor(() => expect(document.querySelector('[data-testid="fields-wrapper"]')).not.toBeNull())
    expect(screen.queryByTestId('body-readonly')).not.toBeInTheDocument()
  })

  // ── New template (no id) ──────────────────────────────────────────────────

  it('renders blank form (no getInAppTemplate call) when id is empty', async () => {
    mockSearchParams.delete('id')
    render(<Page />)
    await new Promise((r) => setTimeout(r, 50))
    expect(getInAppTemplate).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'admin.notif.tpl.type' })).toBeInTheDocument()
  })

  // ── Double-create prevention ──────────────────────────────────────────────

  it('calls updateInAppTemplate (not a second create) on second Save after new-template create', async () => {
    mockSearchParams.delete('id')
    mockSearchParams.set('type', 'user.welcome')
    const createdTpl = makeDraftTemplate({ ID: 'tpl-new', Title: '', Body: '', Icon: 'bell', Tone: 'neutral' })
    vi.mocked(createInAppTemplate).mockResolvedValue(createdTpl)
    vi.mocked(updateInAppTemplate).mockResolvedValue({ ...createdTpl, AutoDismissMs: 6500 })

    render(<Page />)

    await waitFor(() => {
      // Wait for the page to settle (no loading spinner)
      expect(screen.getByRole('button', { name: 'admin.notif.tpl.save' })).toBeInTheDocument()
    })

    // First Save → createInAppTemplate
    fireEvent.click(screen.getByRole('button', { name: 'admin.notif.tpl.save' }))

    await waitFor(() => {
      expect(createInAppTemplate).toHaveBeenCalledTimes(1)
    })

    // The button is renamed while busy; wait for the create request to settle.
    const save = await screen.findByRole('button', { name: 'admin.notif.tpl.save' })
    await waitFor(() => expect(save).toBeDisabled())
    fireEvent.change(screen.getByLabelText('admin.notif.inapp.autoDismissMs'), { target: { value: '6.5' } })
    fireEvent.click(save)

    await waitFor(() => {
      expect(updateInAppTemplate).toHaveBeenCalledTimes(1)
    })
    expect(createInAppTemplate).toHaveBeenCalledTimes(1)
  })

  // ── Rollback re-renders editors ───────────────────────────────────────────

  it('re-renders InAppPreview with rolled-back title after Rollback', async () => {
    vi.mocked(getInAppTemplate).mockResolvedValue(
      makeDraftTemplate({ Status: 'unpublished', Title: 'Old Title' }),
    )
    const rolledBackTpl = makeDraftTemplate({ Status: 'draft', Title: 'New Title after rollback' })
    vi.mocked(rollbackInAppTemplate).mockResolvedValue(rolledBackTpl)
    vi.mocked(listInAppTemplates).mockResolvedValue({ Templates: [makeDraftTemplate({ Status: 'unpublished', Title: 'Old Title' })], MissingActiveFor: [] })

    render(<Page />)

    // Wait for unpublished state, then open its version list.
    await waitFor(() => {
      expect(screen.getByTestId('in-app-preview')).toHaveAttribute('data-title', 'Old Title')
    })
    fireEvent.click(screen.getByRole('button', { name: 'admin.notif.versions.title' }))
    fireEvent.click(await screen.findByRole('button', { name: 'admin.notif.tpl.rollback' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'admin.notif.tpl.rollback' }))

    // After rollback: preview reflects new title from rolled-back template
    await waitFor(() => {
      expect(screen.getByTestId('in-app-preview')).toHaveAttribute('data-title', 'New Title after rollback')
    })
  })

  it('can restore the currently published version over a draft without publishing it', async () => {
    const published = makeDraftTemplate({ ID: 'tpl-published', Status: 'published', Title: 'Live title' })
    const previous = makeDraftTemplate({ ID: 'tpl-previous', Status: 'unpublished', Title: 'Older title' })
    vi.mocked(listInAppTemplates).mockResolvedValue({ Templates: [makeDraftTemplate(), published, previous], MissingActiveFor: [] })
    vi.mocked(rollbackInAppTemplate).mockResolvedValue(makeDraftTemplate({ Title: 'Live title' }))
    render(<Page />)
    fireEvent.click(await screen.findByRole('button', { name: 'admin.notif.versions.title' }))
    expect(await screen.findByText('admin.notif.status.unpublished')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'admin.notif.versions.open' })).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('button', { name: 'admin.notif.tpl.rollback' })[0])
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'admin.notif.tpl.rollback' }))
    await waitFor(() => expect(rollbackInAppTemplate).toHaveBeenCalledWith('tpl-published'))
    await waitFor(() => expect(screen.getByTestId('in-app-preview')).toHaveAttribute('data-title', 'Live title'))
    expect(screen.getByRole('button', { name: 'admin.notif.tpl.publish' })).toBeInTheDocument()
  })

  // ── Translated status in StatusPill ──────────────────────────────────────

  it('shows translated i18n key (not raw Go string) via StatusPill for a published template', async () => {
    vi.mocked(getInAppTemplate).mockResolvedValue(
      makeDraftTemplate({ Status: 'published' }),
    )
    render(<Page />)

    await waitFor(() => {
      // t() is mocked to return the key; statusLabelKey('published') = 'admin.notif.status.published'
      // StatusPill renders the label prop, so the translated key should appear in the document
      expect(screen.getByText('admin.notif.status.published')).toBeInTheDocument()
    })
  })

  // ── Send test button + modal ──────────────────────────────────────────────

  it('shows Send test button when a template is loaded', async () => {
    render(<Page />)
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'admin.notif.test.button' }),
      ).toBeInTheDocument()
    })
  })

  // ── AccentColor clear button ──────────────────────────────────────────────

  it('clears the custom accent and returns to the tone color', async () => {
    vi.mocked(getInAppTemplate).mockResolvedValue(
      makeDraftTemplate({ AccentColor: '#ff0000' }),
    )
    render(<Page />)

    // Wait for template to load — ColorPicker should show the set color
    await waitFor(() => {
      const picker = screen.getByTestId('color-picker-admin.notif.inapp.accentColor')
      expect(picker).toHaveTextContent('#ff0000')
    })

    // Click the Clear / "Use tone color" button
    fireEvent.click(screen.getByRole('button', { name: 'admin.notif.inapp.accentClear' }))

    // After clear, the selected info tone determines the color.
    await waitFor(() => {
      const picker = screen.getByTestId('color-picker-admin.notif.inapp.accentColor')
      expect(picker).toHaveTextContent('#0091EA')
    })
  })

  // ── Send test button + modal ──────────────────────────────────────────────

  it('opens TestNotificationModal with channels=["in_app"], notificationType, and templateId on Send test click', async () => {
    render(<Page />)

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'admin.notif.test.button' }),
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'admin.notif.test.button' }))

    await waitFor(() => {
      const modal = screen.getByTestId('test-notification-modal')
      expect(modal).toBeInTheDocument()
      expect(modal).toHaveAttribute('data-notification-type', 'user.welcome')
      expect(modal).toHaveAttribute('data-template-id', 'tpl-001')
      expect(modal).toHaveAttribute('data-channels', JSON.stringify(['in_app']))
    })
  })
})
