/**
 * BlockEditor.test.tsx — TDD tests for the BlockEditor component.
 *
 * RichTextEditor is mocked because Lexical's $setNodeKey requires an
 * active editor context that jsdom cannot provide reliably.
 * ColorPicker is mocked because it uses canvas / EyeDropper APIs absent in jsdom.
 *
 * All assertions are at the BlockEditor list/controls level (onChange args,
 * aria-labels, data-testids) — we do not test the mounted rich-text internals.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { EmailBodyBlock } from './previewHtml'
import type { BlockPreset } from '@/api/notifications/emailTemplates'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('./RichTextEditor', () => ({
  RichTextEditor: ({ placeholder }: { placeholder?: string }) => (
    <div data-testid="rich-text-editor" aria-label={placeholder ?? 'rich text editor'} />
  ),
  default: ({ placeholder }: { placeholder?: string }) => (
    <div data-testid="rich-text-editor" aria-label={placeholder ?? 'rich text editor'} />
  ),
}))

vi.mock('./ColorPicker', () => ({
  ColorPicker: ({ label }: { label?: string }) => (
    <div data-testid="color-picker" aria-label={label ?? 'color picker'} />
  ),
  default: ({ label }: { label?: string }) => (
    <div data-testid="color-picker" aria-label={label ?? 'color picker'} />
  ),
}))

// Import after mocks
import { BlockEditor } from './BlockEditor'

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeRichText(): EmailBodyBlock {
  return {
    type: 'rich_text',
    content: { root: { children: [], type: 'root', version: 1, direction: null, format: '', indent: 0 } },
  }
}

function makeButton(): EmailBodyBlock {
  return { type: 'button', label: 'Click me', url: 'https://example.com' }
}

function makeDivider(): EmailBodyBlock {
  return { type: 'divider' }
}

const samplePreset: BlockPreset = {
  ID: 'preset-1',
  Name: 'My Preset',
  Description: '',
  Blocks: [makeRichText()],
  CreatedAt: '2024-01-01T00:00:00Z',
  UpdatedAt: '2024-01-01T00:00:00Z',
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BlockEditor', () => {
  let onChange: ReturnType<typeof vi.fn>
  let onSavePreset: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onChange = vi.fn()
    onSavePreset = vi.fn().mockResolvedValue(undefined)
  })

  // ── Rendering ─────────────────────────────────────────────────────────────

  it('renders nothing when value is empty', () => {
    render(
      <BlockEditor
        value={[]}
        onChange={onChange}
        presets={[]}
        onSavePreset={onSavePreset}
      />
    )
    expect(screen.queryAllByTestId('block-item')).toHaveLength(0)
  })

  it('renders one block-item per block in value', () => {
    render(
      <BlockEditor
        value={[makeRichText(), makeButton()]}
        onChange={onChange}
        presets={[]}
        onSavePreset={onSavePreset}
      />
    )
    expect(screen.getAllByTestId('block-item')).toHaveLength(2)
  })

  it('renders a rich_text block with the RichTextEditor', () => {
    render(
      <BlockEditor
        value={[makeRichText()]}
        onChange={onChange}
        presets={[]}
        onSavePreset={onSavePreset}
      />
    )
    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument()
  })

  it('renders a divider block', () => {
    render(
      <BlockEditor
        value={[makeDivider()]}
        onChange={onChange}
        presets={[]}
        onSavePreset={onSavePreset}
      />
    )
    // Divider block should render without crashing
    expect(screen.getAllByTestId('block-item')).toHaveLength(1)
  })

  it('renders available presets in the add-block tray', () => {
    render(
      <BlockEditor
        value={[]}
        onChange={onChange}
        presets={[samplePreset]}
        onSavePreset={onSavePreset}
      />
    )
    expect(screen.getByRole('button', { name: /my preset/i })).toBeInTheDocument()
  })

  // ── Add block ─────────────────────────────────────────────────────────────

  it('clicking "Add text block" calls onChange with one more block (rich_text)', () => {
    render(
      <BlockEditor
        value={[makeButton()]}
        onChange={onChange}
        presets={[]}
        onSavePreset={onSavePreset}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /add text block/i }))
    expect(onChange).toHaveBeenCalledOnce()
    const [next] = onChange.mock.calls[0] as [EmailBodyBlock[]]
    expect(next).toHaveLength(2)
    expect(next[1].type).toBe('rich_text')
  })

  it('clicking "Add button block" calls onChange with one more block (button)', () => {
    render(
      <BlockEditor
        value={[]}
        onChange={onChange}
        presets={[]}
        onSavePreset={onSavePreset}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /add button block/i }))
    expect(onChange).toHaveBeenCalledOnce()
    const [next] = onChange.mock.calls[0] as [EmailBodyBlock[]]
    expect(next).toHaveLength(1)
    expect(next[0].type).toBe('button')
  })

  it('clicking "Add divider block" calls onChange with one more block (divider)', () => {
    render(
      <BlockEditor
        value={[]}
        onChange={onChange}
        presets={[]}
        onSavePreset={onSavePreset}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /add divider block/i }))
    const [next] = onChange.mock.calls[0] as [EmailBodyBlock[]]
    expect(next).toHaveLength(1)
    expect(next[0].type).toBe('divider')
  })

  it('clicking "Add image block" calls onChange with one more block (image)', () => {
    render(
      <BlockEditor
        value={[]}
        onChange={onChange}
        presets={[]}
        onSavePreset={onSavePreset}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /add image block/i }))
    const [next] = onChange.mock.calls[0] as [EmailBodyBlock[]]
    expect(next).toHaveLength(1)
    expect(next[0].type).toBe('image')
  })

  it('clicking a preset in the tray calls onChange with a preset block appended', () => {
    render(
      <BlockEditor
        value={[makeRichText()]}
        onChange={onChange}
        presets={[samplePreset]}
        onSavePreset={onSavePreset}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /my preset/i }))
    expect(onChange).toHaveBeenCalledOnce()
    const [next] = onChange.mock.calls[0] as [EmailBodyBlock[]]
    expect(next).toHaveLength(2)
    expect(next[1].type).toBe('preset')
    expect((next[1] as { type: 'preset'; preset_id: string }).preset_id).toBe('preset-1')
  })

  // ── Delete ────────────────────────────────────────────────────────────────

  it('clicking "Remove block" on the first block removes it (onChange with -1 length)', () => {
    render(
      <BlockEditor
        value={[makeRichText(), makeButton()]}
        onChange={onChange}
        presets={[]}
        onSavePreset={onSavePreset}
      />
    )
    const removeButtons = screen.getAllByRole('button', { name: /remove block/i })
    fireEvent.click(removeButtons[0])
    expect(onChange).toHaveBeenCalledOnce()
    const [next] = onChange.mock.calls[0] as [EmailBodyBlock[]]
    expect(next).toHaveLength(1)
    expect(next[0].type).toBe('button')
  })

  it('clicking "Remove block" on the last block removes it', () => {
    render(
      <BlockEditor
        value={[makeRichText(), makeDivider()]}
        onChange={onChange}
        presets={[]}
        onSavePreset={onSavePreset}
      />
    )
    const removeButtons = screen.getAllByRole('button', { name: /remove block/i })
    fireEvent.click(removeButtons[1])
    const [next] = onChange.mock.calls[0] as [EmailBodyBlock[]]
    expect(next).toHaveLength(1)
    expect(next[0].type).toBe('rich_text')
  })

  // ── Reorder ───────────────────────────────────────────────────────────────

  it('move-down on block[0] swaps it with block[1] in onChange output', () => {
    render(
      <BlockEditor
        value={[makeRichText(), makeButton()]}
        onChange={onChange}
        presets={[]}
        onSavePreset={onSavePreset}
      />
    )
    const downButtons = screen.getAllByRole('button', { name: /move block down/i })
    fireEvent.click(downButtons[0])
    expect(onChange).toHaveBeenCalledOnce()
    const [next] = onChange.mock.calls[0] as [EmailBodyBlock[]]
    expect(next).toHaveLength(2)
    expect(next[0].type).toBe('button')
    expect(next[1].type).toBe('rich_text')
  })

  it('move-up on block[1] swaps it with block[0] in onChange output', () => {
    render(
      <BlockEditor
        value={[makeRichText(), makeButton()]}
        onChange={onChange}
        presets={[]}
        onSavePreset={onSavePreset}
      />
    )
    const upButtons = screen.getAllByRole('button', { name: /move block up/i })
    fireEvent.click(upButtons[1])
    expect(onChange).toHaveBeenCalledOnce()
    const [next] = onChange.mock.calls[0] as [EmailBodyBlock[]]
    expect(next).toHaveLength(2)
    expect(next[0].type).toBe('button')
    expect(next[1].type).toBe('rich_text')
  })

  it('move-down on the last block does not call onChange', () => {
    render(
      <BlockEditor
        value={[makeRichText(), makeButton()]}
        onChange={onChange}
        presets={[]}
        onSavePreset={onSavePreset}
      />
    )
    const downButtons = screen.getAllByRole('button', { name: /move block down/i })
    // Last button should be disabled — click it anyway
    fireEvent.click(downButtons[downButtons.length - 1])
    expect(onChange).not.toHaveBeenCalled()
  })

  it('move-up on the first block does not call onChange', () => {
    render(
      <BlockEditor
        value={[makeRichText(), makeButton()]}
        onChange={onChange}
        presets={[]}
        onSavePreset={onSavePreset}
      />
    )
    const upButtons = screen.getAllByRole('button', { name: /move block up/i })
    fireEvent.click(upButtons[0])
    expect(onChange).not.toHaveBeenCalled()
  })

  // ── Three-block reorder sanity ────────────────────────────────────────────

  it('move-down on block[1] (middle) swaps with block[2]', () => {
    const blocks = [makeRichText(), makeButton(), makeDivider()]
    render(
      <BlockEditor
        value={blocks}
        onChange={onChange}
        presets={[]}
        onSavePreset={onSavePreset}
      />
    )
    const downButtons = screen.getAllByRole('button', { name: /move block down/i })
    fireEvent.click(downButtons[1]) // move middle down
    const [next] = onChange.mock.calls[0] as [EmailBodyBlock[]]
    expect(next.map((b) => b.type)).toEqual(['rich_text', 'divider', 'button'])
  })

  // ── Save-as-preset flow ───────────────────────────────────────────────────

  it('selecting blocks reveals "Save as preset" button', () => {
    render(
      <BlockEditor
        value={[makeRichText(), makeButton()]}
        onChange={onChange}
        presets={[]}
        onSavePreset={onSavePreset}
      />
    )
    // Before selection — no save button
    expect(screen.queryByRole('button', { name: /save as preset/i })).not.toBeInTheDocument()

    // Select first block
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])

    // Now save button should appear
    expect(screen.getByRole('button', { name: /save as preset/i })).toBeInTheDocument()
  })

  it('save-as-preset flow calls onSavePreset with selected blocks and the entered name', async () => {
    render(
      <BlockEditor
        value={[makeRichText(), makeButton()]}
        onChange={onChange}
        presets={[]}
        onSavePreset={onSavePreset}
      />
    )
    // Select first block (rich_text)
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])

    // Open save-preset form
    fireEvent.click(screen.getByRole('button', { name: /save as preset/i }))

    // Enter preset name
    const nameInput = screen.getByPlaceholderText(/preset name/i)
    fireEvent.change(nameInput, { target: { value: 'Header Block' } })

    // Submit
    const saveBtn = screen.getByRole('button', { name: /^save$/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(onSavePreset).toHaveBeenCalledWith(
        [expect.objectContaining({ type: 'rich_text' })],
        'Header Block'
      )
    })
  })

  it('save-as-preset with multiple selected blocks passes all selected blocks', async () => {
    render(
      <BlockEditor
        value={[makeRichText(), makeButton(), makeDivider()]}
        onChange={onChange}
        presets={[]}
        onSavePreset={onSavePreset}
      />
    )
    // Select blocks 0 and 2
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[2])

    fireEvent.click(screen.getByRole('button', { name: /save as preset/i }))

    const nameInput = screen.getByPlaceholderText(/preset name/i)
    fireEvent.change(nameInput, { target: { value: 'Multi' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(onSavePreset).toHaveBeenCalledOnce()
      const [blocks, name] = onSavePreset.mock.calls[0] as [EmailBodyBlock[], string]
      expect(name).toBe('Multi')
      expect(blocks).toHaveLength(2)
      expect(blocks[0].type).toBe('rich_text')
      expect(blocks[1].type).toBe('divider')
    })
  })

  it('save-preset Cancel button hides the name form', () => {
    render(
      <BlockEditor
        value={[makeRichText()]}
        onChange={onChange}
        presets={[]}
        onSavePreset={onSavePreset}
      />
    )
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(screen.getByRole('button', { name: /save as preset/i }))

    // Form visible
    expect(screen.getByPlaceholderText(/preset name/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    // Form hidden
    expect(screen.queryByPlaceholderText(/preset name/i)).not.toBeInTheDocument()
  })

  // ── Variables prop ────────────────────────────────────────────────────────

  it('accepts variables prop without throwing', () => {
    expect(() =>
      render(
        <BlockEditor
          value={[makeRichText()]}
          onChange={onChange}
          variables={[{ name: 'Name', description: 'User name' }]}
          presets={[]}
          onSavePreset={onSavePreset}
        />
      )
    ).not.toThrow()
  })
})
