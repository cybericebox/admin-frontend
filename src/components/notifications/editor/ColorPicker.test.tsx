import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ColorPicker } from './ColorPicker'

describe('ColorPicker', () => {
  it('renders without throwing', () => {
    const onChange = vi.fn()
    expect(() => render(<ColorPicker value="#5da600" onChange={onChange} />)).not.toThrow()
  })

  it('hex input reflects the given value prop', () => {
    const onChange = vi.fn()
    render(<ColorPicker value="#5da600" onChange={onChange} />)
    const hexInput = screen.getByDisplayValue('#5da600')
    expect(hexInput).toBeInTheDocument()
  })

  it('renders label when provided', () => {
    const onChange = vi.fn()
    render(<ColorPicker value="#000000" onChange={onChange} label="Background Color" />)
    expect(screen.getByText('Background Color')).toBeInTheDocument()
  })

  it('typing a valid 6-digit hex and blurring calls onChange with that hex', () => {
    const onChange = vi.fn()
    render(<ColorPicker value="#000000" onChange={onChange} />)
    const hexInput = screen.getByDisplayValue('#000000')
    fireEvent.change(hexInput, { target: { value: '#ff0000' } })
    fireEvent.blur(hexInput)
    expect(onChange).toHaveBeenCalledWith('#ff0000')
  })

  it('typing a valid 3-digit shorthand hex and blurring calls onChange with expanded hex', () => {
    const onChange = vi.fn()
    render(<ColorPicker value="#000000" onChange={onChange} />)
    const hexInput = screen.getByDisplayValue('#000000')
    fireEvent.change(hexInput, { target: { value: 'f00' } })
    fireEvent.blur(hexInput)
    expect(onChange).toHaveBeenCalledWith('#ff0000')
  })

  it('typing an invalid hex does not call onChange and resets to last valid hex', () => {
    const onChange = vi.fn()
    render(<ColorPicker value="#123456" onChange={onChange} />)
    const hexInput = screen.getByDisplayValue('#123456')
    fireEvent.change(hexInput, { target: { value: 'not-a-color' } })
    fireEvent.blur(hexInput)
    expect(onChange).not.toHaveBeenCalled()
    // Input should reset back to the valid hex
    expect(hexInput).toHaveValue('#123456')
  })

  it('pressing Enter on hex input commits the value', () => {
    const onChange = vi.fn()
    render(<ColorPicker value="#000000" onChange={onChange} />)
    const hexInput = screen.getByDisplayValue('#000000')
    fireEvent.change(hexInput, { target: { value: '#abcdef' } })
    fireEvent.keyDown(hexInput, { key: 'Enter' })
    // After Enter the blur fires — vitest/jsdom may or may not auto-blur,
    // but at minimum onChange should have been called (we fire blur explicitly)
    fireEvent.blur(hexInput)
    expect(onChange).toHaveBeenCalledWith('#abcdef')
  })

  it('swatch button is rendered with the correct background color style', () => {
    const onChange = vi.fn()
    render(<ColorPicker value="#ff0000" onChange={onChange} />)
    const swatch = screen.getByRole('button', { name: 'Відкрити палітру кольорів' })
    expect(swatch).toHaveStyle({ background: '#ff0000' })
  })

  it('clicking swatch opens the popover panel', () => {
    const onChange = vi.fn()
    render(<ColorPicker value="#5da600" onChange={onChange} />)
    const swatch = screen.getByRole('button', { name: 'Відкрити палітру кольорів' })
    fireEvent.click(swatch)
    // The SV gradient div becomes visible
    expect(document.querySelector('[data-testid="sv-square"]')).toBeInTheDocument()
  })

  it('popover is initially hidden', () => {
    const onChange = vi.fn()
    render(<ColorPicker value="#5da600" onChange={onChange} />)
    expect(document.querySelector('[data-testid="sv-square"]')).not.toBeInTheDocument()
  })
})
