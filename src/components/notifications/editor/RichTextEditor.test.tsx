import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createEditor } from 'lexical'
import {
  RichTextEditor,
  VariableNode,
  $createVariableNode,
  $isVariableNode,
} from './RichTextEditor'

// Lexical + jsdom: smoke / structural tests only.
// Full editor interactions (typing, selection, typeahead) require a real browser.
//
// jsdom limitation: LexicalNode constructor calls $setNodeKey which requires an
// active editor context. Tests that directly instantiate nodes must use
// createEditor() + editor.update() to provide that context.

describe('RichTextEditor', () => {
  it('mounts without throwing given null state', () => {
    const onChange = vi.fn()
    expect(() => render(<RichTextEditor value={null} onChange={onChange} />)).not.toThrow()
  })

  it('renders a contenteditable element', () => {
    const onChange = vi.fn()
    render(<RichTextEditor value={null} onChange={onChange} />)
    expect(document.querySelector('[contenteditable]')).toBeInTheDocument()
  })

  it('toolbar buttons render when editor is active (not disabled)', () => {
    const onChange = vi.fn()
    render(<RichTextEditor value={null} onChange={onChange} />)
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0)
  })

  it('does not render toolbar when disabled=true', () => {
    const onChange = vi.fn()
    const { container } = render(
      <RichTextEditor value={null} onChange={onChange} disabled />
    )
    expect(container.querySelectorAll('button').length).toBe(0)
  })

  it('onChange callback is accepted without throwing', () => {
    const onChange = vi.fn()
    expect(() =>
      render(<RichTextEditor value={null} onChange={onChange} />)
    ).not.toThrow()
  })

  it('accepts variables prop without throwing', () => {
    const onChange = vi.fn()
    expect(() =>
      render(
        <RichTextEditor
          value={null}
          onChange={onChange}
          variables={[{ name: 'Name', description: 'User name' }]}
        />
      )
    ).not.toThrow()
  })

  it('accepts a placeholder prop without throwing', () => {
    const onChange = vi.fn()
    expect(() =>
      render(
        <RichTextEditor
          value={null}
          onChange={onChange}
          placeholder="Start typing…"
        />
      )
    ).not.toThrow()
  })
})

describe('VariableNode', () => {
  it('VariableNode.getType() returns "variable"', () => {
    // Static method — no active editor required
    expect(VariableNode.getType()).toBe('variable')
  })

  it('$isVariableNode returns false for non-VariableNode values', () => {
    // No active editor needed for negative checks
    expect($isVariableNode('a string')).toBe(false)
    expect($isVariableNode(null)).toBe(false)
    expect($isVariableNode(undefined)).toBe(false)
    expect($isVariableNode({})).toBe(false)
    expect($isVariableNode(42)).toBe(false)
  })

  it('$createVariableNode creates a VariableNode and $isVariableNode identifies it', () => {
    // Node constructor requires an active editor context in Lexical — use createEditor
    const editor = createEditor({ nodes: [VariableNode] })
    let result = false
    // editor.update callback runs synchronously for the node-creation bookkeeping
    editor.update(() => {
      const node = $createVariableNode('Name')
      result = $isVariableNode(node)
    })
    expect(result).toBe(true)
  })
})
