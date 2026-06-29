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
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
    vi.mocked(getInAppTemplate).mockResolvedValue(makeDraftTemplate())
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

  // ── Fields ────────────────────────────────────────────────────────────────

  it('renders the Title VariableRichText (textbox) after load', async () => {
    render(<Page />)
    await waitFor(() => {
      const textboxes = screen.getAllByRole('textbox')
      expect(textboxes.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('renders Icon, Tone, Surface selects after load', async () => {
    render(<Page />)
    await waitFor(() => {
      // comboboxes = <select> elements
      const combos = screen.getAllByRole('combobox')
      expect(combos.length).toBeGreaterThanOrEqual(3)
    })
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

  it('shows Rollback button for a published template', async () => {
    vi.mocked(getInAppTemplate).mockResolvedValue(
      makeDraftTemplate({ Status: 'published' }),
    )
    render(<Page />)
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'admin.notif.tpl.rollback' }),
      ).toBeInTheDocument()
    })
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

  // ── New template (no id) ──────────────────────────────────────────────────

  it('renders blank form (no getInAppTemplate call) when id is empty', async () => {
    mockSearchParams.delete('id')
    render(<Page />)
    await new Promise((r) => setTimeout(r, 50))
    expect(getInAppTemplate).not.toHaveBeenCalled()
    // Type combobox visible for new template
    const combos = screen.getAllByRole('combobox')
    // At least the type selector should be among them
    expect(combos.length).toBeGreaterThanOrEqual(1)
  })

  // ── Double-create prevention ──────────────────────────────────────────────

  it('calls updateInAppTemplate (not a second create) on second Save after new-template create', async () => {
    mockSearchParams.delete('id')
    const createdTpl = makeDraftTemplate({ ID: 'tpl-new' })
    vi.mocked(createInAppTemplate).mockResolvedValue(createdTpl)
    vi.mocked(updateInAppTemplate).mockResolvedValue(createdTpl)

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

    // Second Save → updateInAppTemplate, createInAppTemplate still once
    fireEvent.click(screen.getByRole('button', { name: 'admin.notif.tpl.save' }))

    await waitFor(() => {
      expect(updateInAppTemplate).toHaveBeenCalledTimes(1)
    })
    expect(createInAppTemplate).toHaveBeenCalledTimes(1)
  })

  // ── Rollback re-renders editors ───────────────────────────────────────────

  it('re-renders InAppPreview with rolled-back title after Rollback', async () => {
    vi.mocked(getInAppTemplate).mockResolvedValue(
      makeDraftTemplate({ Status: 'published', Title: 'Old Title' }),
    )
    const rolledBackTpl = makeDraftTemplate({ Status: 'draft', Title: 'New Title after rollback' })
    vi.mocked(rollbackInAppTemplate).mockResolvedValue(rolledBackTpl)

    render(<Page />)

    // Wait for published state — preview shows old title, Rollback button visible
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'admin.notif.tpl.rollback' })).toBeInTheDocument()
      expect(screen.getByTestId('in-app-preview')).toHaveAttribute('data-title', 'Old Title')
    })

    fireEvent.click(screen.getByRole('button', { name: 'admin.notif.tpl.rollback' }))

    // After rollback: preview reflects new title from rolled-back template
    await waitFor(() => {
      expect(screen.getByTestId('in-app-preview')).toHaveAttribute('data-title', 'New Title after rollback')
    })
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

  it('clicking accent Clear button resets accentColor to "" (ColorPicker falls back to #000000)', async () => {
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

    // After clear: accentColor="" → value prop becomes "" || "#000000" = "#000000"
    await waitFor(() => {
      const picker = screen.getByTestId('color-picker-admin.notif.inapp.accentColor')
      expect(picker).toHaveTextContent('#000000')
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
