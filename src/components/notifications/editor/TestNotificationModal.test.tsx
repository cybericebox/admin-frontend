/**
 * TestNotificationModal.test.tsx — TDD RED→GREEN
 *
 * Covers: variable seeding, channel checkboxes, send payload, success/error
 * state, TemplateID opt-in, and variable editing before send.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ── Mocks (must be declared before module imports) ────────────────────────────

// Stable fixture — same reference on every mock call to avoid useEffect loops.
const MOCK_TYPES = [
  {
    Type: 'user_invitation',
    Channels: ['email', 'in_app'],
    Variables: [{ Name: 'InviteURL', Description: 'the invite link', Default: 'https://x' }],
  },
]

vi.mock('@/api/notifications/test', () => ({
  sendTestNotification: vi.fn(),
}))

vi.mock('@/components/notifications/templateTypes', () => ({
  useNotificationTypes: vi.fn(() => MOCK_TYPES),
}))

// ── Module imports (after mocks) ──────────────────────────────────────────────

import { sendTestNotification } from '@/api/notifications/test'
import { t } from '@/i18n/t'
import { TestNotificationModal } from './TestNotificationModal'

const mockSend = vi.mocked(sendTestNotification)

// ── Helpers ───────────────────────────────────────────────────────────────────

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  notificationType: 'user_invitation',
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TestNotificationModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSend.mockResolvedValue(undefined)
  })

  it('renders input pre-filled with variable Default', () => {
    render(<TestNotificationModal {...defaultProps} />)
    expect(screen.getByDisplayValue('https://x')).toBeTruthy()
  })

  it('renders channel checkboxes for email and in_app, both checked by default', () => {
    render(<TestNotificationModal {...defaultProps} />)
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(2)
    checkboxes.forEach((cb) => expect(cb).toBeChecked())
  })

  it('calls sendTestNotification with correct payload (no TemplateID) on Send', async () => {
    render(<TestNotificationModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: t('admin.notif.test.send') }))
    await waitFor(() => expect(mockSend).toHaveBeenCalledOnce())
    expect(mockSend).toHaveBeenCalledWith({
      Type: 'user_invitation',
      Channels: ['email', 'in_app'],
      Variables: { InviteURL: 'https://x' },
    })
  })

  it('shows success message after a successful Send', async () => {
    render(<TestNotificationModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: t('admin.notif.test.send') }))
    await screen.findByText(t('admin.notif.test.sent'))
  })

  it('sends the edited variable value when input is changed before Send', async () => {
    render(<TestNotificationModal {...defaultProps} />)
    const input = screen.getByDisplayValue('https://x')
    fireEvent.change(input, { target: { value: 'https://y' } })
    fireEvent.click(screen.getByRole('button', { name: t('admin.notif.test.send') }))
    await waitFor(() => expect(mockSend).toHaveBeenCalledOnce())
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ Variables: { InviteURL: 'https://y' } })
    )
  })

  it('includes TemplateID in payload when templateId prop is provided', async () => {
    render(<TestNotificationModal {...defaultProps} templateId="t1" />)
    fireEvent.click(screen.getByRole('button', { name: t('admin.notif.test.send') }))
    await waitFor(() => expect(mockSend).toHaveBeenCalledOnce())
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ TemplateID: 't1' })
    )
  })

  it('shows error message when sendTestNotification rejects', async () => {
    mockSend.mockRejectedValueOnce(new Error('network error'))
    render(<TestNotificationModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: t('admin.notif.test.send') }))
    await screen.findByText(t('admin.notif.test.error'))
  })

  it('drops unchecked channel from Channels when sending', async () => {
    render(<TestNotificationModal {...defaultProps} />)
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(screen.getByRole('button', { name: t('admin.notif.test.send') }))
    await waitFor(() => expect(mockSend).toHaveBeenCalledOnce())
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ Channels: ['in_app'] })
    )
  })

  // ── Send disabled when no channels selected ───────────────────────────────

  it('disables Send button when all channels are unchecked', () => {
    render(<TestNotificationModal {...defaultProps} />)
    const checkboxes = screen.getAllByRole('checkbox')
    // Uncheck every channel
    checkboxes.forEach((cb) => fireEvent.click(cb))
    expect(screen.getByRole('button', { name: t('admin.notif.test.send') })).toBeDisabled()
  })

  // ── Seed-once / no mid-session reset ─────────────────────────────────────

  it('does not reset edited field when channels prop reference changes (parent re-render)', () => {
    const { rerender } = render(
      <TestNotificationModal {...defaultProps} channels={['email', 'in_app']} />
    )
    const input = screen.getByDisplayValue('https://x')
    fireEvent.change(input, { target: { value: 'my-edited-url' } })
    // Simulate parent re-render: same logical value but a new array reference
    rerender(
      <TestNotificationModal {...defaultProps} channels={['email', 'in_app']} />
    )
    // Edit must survive the re-render
    expect(screen.getByDisplayValue('my-edited-url')).toBeTruthy()
  })

  it('re-seeds fields and channels when modal is closed then reopened', () => {
    const { rerender } = render(<TestNotificationModal {...defaultProps} />)
    const input = screen.getByDisplayValue('https://x')
    fireEvent.change(input, { target: { value: 'edited-before-close' } })

    // Close
    rerender(<TestNotificationModal {...defaultProps} open={false} />)
    // Reopen
    rerender(<TestNotificationModal {...defaultProps} open={true} />)

    // Fields must revert to defaults on reopen
    expect(screen.getByDisplayValue('https://x')).toBeTruthy()
  })
})
